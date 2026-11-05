//! Fixed, bounded Node entrypoint for Wikidata movie ingestion.

use std::path::Path;

use anyhow::Result;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::Value;
use tokio::process::Command;

use crate::context::JobContext;
use crate::handler::{JobHandler, JobOutcome, PermanentError};

pub const JOB_TYPE: &str = "catalog.movies.sync";
pub const CONCURRENCY_KEY: &str = "catalog.movies";
const SCRIPT: &str = "/app/apps/api/dist/scripts/sync-movies.js";

pub struct CatalogMoviesHandler;

#[async_trait]
impl JobHandler for CatalogMoviesHandler {
    fn job_type(&self) -> &'static str {
        JOB_TYPE
    }

    fn concurrency_key(&self, _payload: &Value) -> Option<String> {
        Some(CONCURRENCY_KEY.into())
    }

    async fn run(&self, ctx: &JobContext) -> Result<JobOutcome> {
        if ctx
            .payload()
            .as_object()
            .is_none_or(|payload| !payload.is_empty())
        {
            return Err(PermanentError::err(
                "catalog.movies.sync expects an empty payload",
            ));
        }
        if std::env::var("DATABASE_URL")
            .unwrap_or_default()
            .trim()
            .is_empty()
        {
            return Err(PermanentError::err(
                "DATABASE_URL is required for movie catalog sync",
            ));
        }
        if !Path::new(SCRIPT).is_file() {
            return Err(PermanentError::err(
                "The compiled movie sync CLI is missing; deploy the current worker image",
            ));
        }
        let secrets = ["DATABASE_URL", "TYPESENSE_API_KEY", "LOG_TYPESENSE_API_KEY"]
            .into_iter()
            .filter_map(|key| std::env::var(key).ok())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();
        let mut command = Command::new("/usr/local/bin/node");
        command
            .arg("--enable-source-maps")
            .arg(SCRIPT)
            .current_dir("/app");
        // Provider state is committed in PostgreSQL, independent of a job ID.
        // Cancellation reaps the child; a later run resumes those durable markers.
        super::run_command_with_spec(ctx, command, &secrets, &super::MOVIES).await
    }
}

/// Only this fixed movie CLI may request a continuation. No command/type/payload
/// may be supplied by the subprocess. Lack of committed progress ends the chain.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncResult {
    has_more: bool,
    progress_made: bool,
    next_run_at: Option<DateTime<Utc>>,
}

pub(super) fn parse_result(line: &str) -> Result<Option<Option<DateTime<Utc>>>> {
    let Some(raw) = line.strip_prefix("[catalog:movies] result ") else {
        return Ok(None);
    };
    let result: SyncResult = serde_json::from_str(raw)
        .map_err(|_| anyhow::anyhow!("Movie CLI returned an invalid completion summary"))?;
    Ok(Some(continuation_at(result, Utc::now())))
}

fn continuation_at(result: SyncResult, now: DateTime<Utc>) -> Option<DateTime<Utc>> {
    if !result.has_more || !result.progress_made {
        return None;
    }
    let earliest = now + chrono::Duration::seconds(30);
    // Never tight-loop or hold a remote-provided unbounded scheduling value.
    let latest = now + chrono::Duration::days(7);
    Some(
        result
            .next_run_at
            .unwrap_or(earliest)
            .max(earliest)
            .min(latest),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn completion_protocol_requires_committed_work_and_is_movie_only() {
        assert!(
            parse_result("[catalog:popularity] result {} ")
                .unwrap()
                .is_none()
        );
        assert!(parse_result("[catalog:movies] result invalid").is_err());
        assert_eq!(
            parse_result(
                r#"[catalog:movies] result {"hasMore":true,"progressMade":false,"nextRunAt":null}"#
            )
            .unwrap(),
            Some(None)
        );
        assert_eq!(
            parse_result(
                r#"[catalog:movies] result {"hasMore":false,"progressMade":true,"nextRunAt":null}"#
            )
            .unwrap(),
            Some(None)
        );
        let now = Utc::now();
        let next = continuation_at(
            SyncResult {
                has_more: true,
                progress_made: true,
                next_run_at: Some(now),
            },
            now,
        )
        .unwrap();
        assert_eq!(next, now + chrono::Duration::seconds(30));
        let later = now + chrono::Duration::minutes(10);
        assert_eq!(
            continuation_at(
                SyncResult {
                    has_more: true,
                    progress_made: true,
                    next_run_at: Some(later)
                },
                now
            ),
            Some(later)
        );
    }

    #[test]
    fn movie_job_has_a_dedicated_database_only_lock() {
        assert_eq!(CatalogMoviesHandler.job_type(), "catalog.movies.sync");
        assert_eq!(
            CatalogMoviesHandler.concurrency_key(&json!({})),
            Some("catalog.movies".into())
        );
        assert_ne!(CONCURRENCY_KEY, super::super::CONCURRENCY_KEY);
    }
}
