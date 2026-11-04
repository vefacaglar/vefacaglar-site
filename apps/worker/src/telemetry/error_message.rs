use std::error::Error;
use std::io;
use std::sync::LazyLock;

use fancy_regex::Regex;
use reqwest::Url;

use crate::jobs::search::backend::TypesenseReplyError;

static REDACTIONS: LazyLock<Vec<(Regex, &'static str)>> = LazyLock::new(|| {
    [
        (r"(?i)\b(?:with args beginning with|(?:request |response )?(?:body|payload|params|parameters))\s*[:=].*$", "[redacted]"),
        (r#"(?i)\b[a-z][a-z\d+.-]*://[^\s"'<>]+"#, "[redacted URL]"),
        (r"\b(?:Bearer|Basic)\s+[\w.+/=-]{8,}", "[redacted authorization]"),
        (r"(?i)\b(?:authorization|(?:set-)?cookie)\s*[:=].*$", "[redacted authorization]"),
        (r#"(?i)\b(?:password|passwd|secret|(?:access[_-]?)?token|(?:x-typesense-)?api[_-]?key)\s*[:=]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;]+)"#, "[redacted credential]"),
        (r"\beyJ[\w-]+\.[\w-]+\.[\w-]+\b", "[redacted token]"),
        (r#""(?:\\.|[^"\\])*"|\x60[^\x60]*\x60|(?<!\w)'(?:\\.|[^'\\])*'"#, "[redacted]"),
        (r"(?:\[(?!redacted(?: [a-z]+)?\])|[{<]).*$", "[redacted]"),
    ]
    .into_iter()
    .map(|(pattern, replacement)| (Regex::new(pattern).expect("valid log redaction pattern"), replacement))
    .collect()
});

fn excerpt(message: &str) -> Option<String> {
    let line = message
        .split(['\r', '\n', '\u{2028}', '\u{2029}'])
        .next()?
        .trim();
    if line.is_empty() || line.len() > 8192 {
        return None;
    }

    let mut safe = line.to_owned();
    for key in ["LOG_TYPESENSE_API_KEY", "TYPESENSE_API_KEY"] {
        if let Ok(value) = std::env::var(key)
            && !value.is_empty()
        {
            safe = safe.replace(&value, "[redacted]");
        }
    }
    if let Ok(url) = std::env::var("DATABASE_URL")
        && let Ok(url) = Url::parse(&url)
        && let Some(password) = url.password().filter(|password| !password.is_empty())
    {
        safe = safe.replace(password, "[redacted]");
    }
    for (pattern, replacement) in REDACTIONS.iter() {
        safe = pattern
            .try_replacen(&safe, 0, *replacement)
            .ok()?
            .into_owned();
    }
    let mut chars = safe
        .trim()
        .chars()
        .map(|ch| if ch.is_control() { ' ' } else { ch });
    let mut result: String = chars.by_ref().take(400).collect();
    if chars.next().is_some() {
        result.push('…');
    }
    (!result.is_empty()).then_some(result)
}

pub fn error_messages(mut error: &(dyn Error + 'static)) -> Option<String> {
    let mut messages = Vec::new();
    for _ in 0..8 {
        let message = if let Some(reply) = error.downcast_ref::<TypesenseReplyError>() {
            reply.diagnostic()
        } else if let Some(sqlx::Error::Database(database)) = error.downcast_ref::<sqlx::Error>() {
            database.message().to_owned()
        } else if let Some(io) = error.downcast_ref::<io::Error>() {
            io.raw_os_error()
                .map(|code| format!("OS error {code}: {}", io.kind()))
                .unwrap_or_default()
        } else if matches!(
            error.downcast_ref::<sqlx::Error>(),
            Some(sqlx::Error::Io(_))
        ) {
            String::new()
        } else {
            error.to_string()
        };
        if let Some(message) = excerpt(&message)
            && !messages.contains(&message)
        {
            messages.push(message);
        }
        if matches!(
            error.downcast_ref::<sqlx::Error>(),
            Some(sqlx::Error::Database(_))
        ) {
            break;
        }
        let Some(source) = error.source() else { break };
        error = source;
    }
    (!messages.is_empty()).then(|| messages.join("\nCaused by "))
}
