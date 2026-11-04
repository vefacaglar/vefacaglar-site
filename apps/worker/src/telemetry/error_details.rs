use std::backtrace::{Backtrace, BacktraceStatus};
use std::error::Error;
use std::io;

use crate::handler::PermanentError;

pub fn application_stack(backtrace: &Backtrace) -> Option<String> {
    if backtrace.status() != BacktraceStatus::Captured {
        return None;
    }
    let text = backtrace.to_string();
    let mut frames = Vec::new();
    for line in text.lines() {
        let Some(location) = line.trim().strip_prefix("at ") else {
            continue;
        };
        let Some((file, line, column)) = parse_location(location) else {
            continue;
        };
        let Some(file) = application_file(file) else {
            continue;
        };
        if file.starts_with("src/telemetry") {
            continue;
        }
        let frame = format!("{file}:{line}:{column}");
        if frames.last() != Some(&frame) {
            frames.push(frame);
        }
        if frames.len() == 12 {
            break;
        }
    }
    (!frames.is_empty()).then(|| frames.join("\n"))
}

pub(super) fn application_file(file: &str) -> Option<&str> {
    let file = file
        .strip_prefix(concat!(env!("CARGO_MANIFEST_DIR"), "/"))
        .unwrap_or(file);
    let file = file.strip_prefix("./").unwrap_or(file);
    (file.starts_with("src/") && file.ends_with(".rs")).then_some(file)
}

fn parse_location(location: &str) -> Option<(&str, u32, u32)> {
    let (location, column) = location.rsplit_once(':')?;
    let (file, line) = location.rsplit_once(':')?;
    if !file
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || b"/_.-".contains(&b))
    {
        return None;
    }
    Some((file, line.parse().ok()?, column.parse().ok()?))
}

pub fn database_error(error: &sqlx::Error) -> (String, &'static str) {
    let (code, reason) = match error {
        sqlx::Error::Configuration(_) => (
            "invalid_database_url",
            "invalid database connection settings",
        ),
        sqlx::Error::Tls(_) => ("database_tls_failed", "Postgres TLS handshake failed"),
        sqlx::Error::Io(_) => (
            "database_io_failed",
            "network communication with Postgres failed",
        ),
        sqlx::Error::PoolTimedOut => (
            "database_timeout",
            "timed out waiting for a Postgres connection",
        ),
        sqlx::Error::PoolClosed => (
            "database_pool_closed",
            "the Postgres connection pool is closed",
        ),
        sqlx::Error::Database(error) => {
            let state = error.code();
            let reason = match state.as_deref() {
                Some("28P01" | "28000") => "Postgres rejected authentication",
                Some("3D000") => "the configured Postgres database does not exist",
                Some("23502") => "a required database value is missing",
                Some("23503") => "a database reference violates a foreign key",
                Some("23505") => "a database value conflicts with a unique constraint",
                Some("40001") => "Postgres aborted a concurrent transaction",
                Some("40P01") => "Postgres detected a deadlock",
                Some("42P01") => "a required database table is missing. Check migrations",
                Some("42703") => "a required database column is missing. Check migrations",
                Some("42501") => "the database role lacks the required permissions",
                _ => "Postgres rejected the operation",
            };
            let code = state
                .filter(|code| {
                    code.len() == 5
                        && code
                            .bytes()
                            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit())
                })
                .map_or_else(
                    || "database_error".into(),
                    |code| format!("sqlstate_{code}"),
                );
            return (code, reason);
        }
        _ => ("database_error", "an unexpected Postgres error occurred"),
    };
    (code.into(), reason)
}

pub(super) fn describe_error(mut error: &(dyn Error + 'static)) -> (String, &'static str) {
    let mut permanent = false;
    for _ in 0..8 {
        if let Some(error) = error.downcast_ref::<sqlx::Error>() {
            return database_error(error);
        }
        if let Some(error) = error.downcast_ref::<reqwest::Error>() {
            if let Some(status) = error.status() {
                return (
                    format!("upstream_http_{}", status.as_u16()),
                    "the upstream HTTP service rejected the request",
                );
            }
            if error.is_timeout() {
                return (
                    "upstream_timeout".into(),
                    "the upstream HTTP request timed out",
                );
            }
            if error.is_connect() {
                return (
                    "upstream_connect_failed".into(),
                    "the worker could not connect to the upstream HTTP service",
                );
            }
        }
        if let Some(error) = error.downcast_ref::<serde_json::Error>() {
            let reason = match error.classify() {
                serde_json::error::Category::Syntax => "JSON syntax is invalid",
                serde_json::error::Category::Data => "JSON data does not match the expected format",
                serde_json::error::Category::Eof => "JSON data ended unexpectedly",
                serde_json::error::Category::Io => "reading or writing JSON data failed",
            };
            return ("json_error".into(), reason);
        }
        if let Some(error) = error.downcast_ref::<io::Error>() {
            let (code, reason) = match error.kind() {
                io::ErrorKind::PermissionDenied => (
                    "io_permission_denied",
                    "the worker lacks filesystem permissions",
                ),
                io::ErrorKind::NotFound => (
                    "io_path_not_found",
                    "the file or its parent directory does not exist",
                ),
                _ => ("io_error", "an unexpected I/O error occurred"),
            };
            return (code.into(), reason);
        }
        permanent |= error.is::<PermanentError>();
        let Some(source) = error.source() else { break };
        error = source;
    }
    if permanent {
        return (
            "permanent_job_error".into(),
            "the job cannot succeed by retrying. See the job log for details",
        );
    }
    (
        "worker_operation_error".into(),
        "see the worker or job log for the full error",
    )
}
