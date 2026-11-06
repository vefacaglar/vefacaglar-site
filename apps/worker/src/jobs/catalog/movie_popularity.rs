//! Runs a bounded Wikipedia interest refresh for movies.

use std::path::Path;

use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use tokio::process::Command;

use crate::context::JobContext;
use crate::handler::{JobHandler, JobOutcome, PermanentError};

pub const JOB_TYPE: &str = "catalog.movies.popularity.refresh";
pub const CONCURRENCY_KEY: &str = "catalog.movies.popularity";
const SCRIPT: &str = "/app/apps/api/dist/scripts/refresh-movie-popularity.js";

pub struct MoviePopularityHandler;

#[async_trait]
impl JobHandler for MoviePopularityHandler {
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
                "DATABASE_URL is required for movie interest refresh",
            ));
        }
        if !Path::new(SCRIPT).is_file() {
            return Err(PermanentError::err(
                "The compiled movie interest CLI is missing; deploy the current worker image",
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
        super::run_command_with_spec(ctx, command, &secrets, &super::MOVIE_POPULARITY).await
    }
}

fn validate_payload(payload: &Value) -> Result<()> {
    if payload.as_object().is_none_or(|object| !object.is_empty()) {
        return Err(PermanentError::err(
            "catalog.movies.popularity.refresh expects an empty payload",
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
    fn interest_has_a_distinct_key_from_the_continuing_catalog_job() {
        assert_eq!(MoviePopularityHandler.job_type(), JOB_TYPE);
        assert_eq!(
            MoviePopularityHandler.concurrency_key(&json!({})),
            Some("catalog.movies.popularity".into())
        );
        assert_ne!(CONCURRENCY_KEY, super::super::movies::CONCURRENCY_KEY);
        assert_ne!(CONCURRENCY_KEY, super::super::CONCURRENCY_KEY);
    }

    #[test]
    fn interest_rejects_user_supplied_arguments() {
        assert!(validate_payload(&json!({})).is_ok());
        for payload in [json!(null), json!([]), json!({"command": "other"})] {
            assert!(is_permanent(&validate_payload(&payload).unwrap_err()));
        }
    }
}
