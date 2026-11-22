//! Refreshes the complete official IGDB completion-time snapshot.

use std::path::Path;

use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use tokio::process::Command;

use crate::context::JobContext;
use crate::handler::{JobHandler, JobOutcome, PermanentError};

pub const JOB_TYPE: &str = "catalog.games.completion_times.refresh";
pub const CONCURRENCY_KEY: &str = "catalog.games.completion_times";
const SCRIPT: &str = "/app/apps/api/dist/scripts/refresh-game-completion-times.js";

pub struct GameCompletionTimesHandler;

#[async_trait]
impl JobHandler for GameCompletionTimesHandler {
    fn job_type(&self) -> &'static str {
        JOB_TYPE
    }

    fn concurrency_key(&self, _payload: &Value) -> Option<String> {
        Some(CONCURRENCY_KEY.into())
    }

    async fn run(&self, ctx: &JobContext) -> Result<JobOutcome> {
        validate_payload(ctx.payload())?;
        for key in ["DATABASE_URL", "IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET"] {
            if std::env::var(key).unwrap_or_default().trim().is_empty() {
                return Err(PermanentError::err(format!(
                    "{key} is required for game completion times refresh"
                )));
            }
        }
        if !Path::new(SCRIPT).is_file() {
            return Err(PermanentError::err(
                "The compiled game completion times CLI is missing; deploy the current worker image",
            ));
        }
        let secrets = ["DATABASE_URL", "IGDB_CLIENT_ID", "IGDB_CLIENT_SECRET"]
            .into_iter()
            .filter_map(|key| std::env::var(key).ok())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>();
        let mut command = Command::new("/usr/local/bin/node");
        command
            .arg("--enable-source-maps")
            .arg(SCRIPT)
            .env("IGDB_REQUEST_INTERVAL_MS", "1000")
            .current_dir("/app");
        super::run_command_with_spec(ctx, command, &secrets, &super::GAME_COMPLETION_TIMES).await
    }
}

fn validate_payload(payload: &Value) -> Result<()> {
    if payload.as_object().is_none_or(|object| !object.is_empty()) {
        return Err(PermanentError::err(
            "catalog.games.completion_times.refresh expects an empty payload",
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
    fn completion_times_have_an_independent_concurrency_key() {
        assert_eq!(GameCompletionTimesHandler.job_type(), JOB_TYPE);
        assert_eq!(
            GameCompletionTimesHandler.concurrency_key(&json!({})),
            Some("catalog.games.completion_times".into())
        );
        assert_ne!(CONCURRENCY_KEY, super::super::movies::CONCURRENCY_KEY);
        assert_ne!(CONCURRENCY_KEY, super::super::CONCURRENCY_KEY);
    }

    #[test]
    fn completion_times_reject_user_supplied_arguments() {
        assert!(validate_payload(&json!({})).is_ok());
        for payload in [json!(null), json!([]), json!({"command": "other"})] {
            assert!(is_permanent(&validate_payload(&payload).unwrap_err()));
        }
    }
}
