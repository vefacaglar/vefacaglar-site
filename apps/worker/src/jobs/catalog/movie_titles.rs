//! Bounded, resumable correction of stored non-English movie titles. The
//! compiled API CLI owns the Wikidata requests, cursor and title writes.

use std::path::Path;

use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use tokio::process::Command;

use crate::context::JobContext;
use crate::handler::{JobHandler, JobOutcome, PermanentError};

pub const JOB_TYPE: &str = "catalog.movies.english_titles";
pub const CONCURRENCY_KEY: &str = "catalog.movies.english_titles";
const SCRIPT: &str = "/app/apps/api/dist/scripts/fix-movie-english-titles.js";

pub struct MovieEnglishTitlesHandler;

#[async_trait]
impl JobHandler for MovieEnglishTitlesHandler {
    fn job_type(&self) -> &'static str {
        JOB_TYPE
    }

    fn concurrency_key(&self, _payload: &Value) -> Option<String> {
        Some(CONCURRENCY_KEY.into())
    }

    async fn run(&self, ctx: &JobContext) -> Result<JobOutcome> {
        validate_payload(ctx.payload())?;
        if std::env::var("DATABASE_URL")
            .unwrap_or_default()
            .trim()
            .is_empty()
        {
            return Err(PermanentError::err(
                "DATABASE_URL is required for movie title correction",
            ));
        }
        if !Path::new(SCRIPT).is_file() {
            return Err(PermanentError::err(
                "The compiled movie title CLI is missing; deploy the current worker image",
            ));
        }
        let secrets = ["DATABASE_URL", "TYPESENSE_API_KEY", "LOG_TYPESENSE_API_KEY"]
            .into_iter()
            .filter_map(|key| std::env::var(key).ok())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();
        let mut command = Command::new("/usr/local/bin/node");
        // No arguments: the CLI's only write mode. Its cursor is committed in
        // PostgreSQL per batch, so cancellation or a retry resumes safely.
        command
            .arg("--enable-source-maps")
            .arg(SCRIPT)
            .current_dir("/app");
        super::run_command_with_spec(ctx, command, &secrets, &super::MOVIE_TITLES).await
    }
}

fn validate_payload(payload: &Value) -> Result<()> {
    if payload.as_object().is_none_or(|object| !object.is_empty()) {
        return Err(PermanentError::err(
            "catalog.movies.english_titles expects an empty payload",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handler::is_permanent;
    use serde_json::json;

    #[test]
    fn titles_have_their_own_lock_and_fixed_payload() {
        assert_eq!(MovieEnglishTitlesHandler.job_type(), JOB_TYPE);
        assert_eq!(
            MovieEnglishTitlesHandler.concurrency_key(&json!({})),
            Some("catalog.movies.english_titles".into())
        );
        assert_ne!(CONCURRENCY_KEY, super::super::movies::CONCURRENCY_KEY);
        assert_ne!(CONCURRENCY_KEY, super::super::CONCURRENCY_KEY);
        assert!(validate_payload(&json!({})).is_ok());
        for payload in [json!(null), json!([]), json!({"dryRun": true})] {
            assert!(is_permanent(&validate_payload(&payload).unwrap_err()));
        }
    }

    #[test]
    fn title_summary_uses_the_shared_continuation_protocol() {
        let prefix = super::super::MOVIE_TITLES.prefix;
        assert!(
            super::super::movies::parse_continuation(
                r#"[catalog:movies] result {"hasMore":true,"progressMade":true,"nextRunAt":null}"#,
                prefix
            )
            .unwrap()
            .is_none()
        );
        assert!(
            super::super::movies::parse_continuation(
                r#"[catalog:movie-titles] result {"hasMore":true,"progressMade":true,"nextRunAt":null,"scanned":50,"changed":3,"errors":0,"requests":1}"#,
                prefix
            )
            .unwrap()
            .unwrap()
            .is_some()
        );
        assert_eq!(
            super::super::movies::parse_continuation(
                r#"[catalog:movie-titles] result {"hasMore":false,"progressMade":true,"nextRunAt":null}"#,
                prefix
            )
            .unwrap(),
            Some(None)
        );
    }
}
