//! Runs the canonical IGDB importer with an atomic database cursor.

use std::path::Path;

use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use tokio::process::Command;

use crate::context::JobContext;
use crate::handler::{JobHandler, JobOutcome, PermanentError};

pub const JOB_TYPE: &str = "catalog.games.import";
pub const CONCURRENCY_KEY: &str = "catalog.games.import";
const SCRIPT: &str = "/app/apps/api/dist/scripts/import-games.js";

pub struct GameImportHandler;

#[async_trait]
impl JobHandler for GameImportHandler {
    fn job_type(&self) -> &'static str {
        JOB_TYPE
    }

    fn concurrency_key(&self, _: &Value) -> Option<String> {
        Some(CONCURRENCY_KEY.into())
    }

    async fn run(&self, ctx: &JobContext) -> Result<JobOutcome> {
        validate_payload(ctx.payload())?;
        for key in [
            "DATABASE_URL",
            "IGDB_CLIENT_ID",
            "IGDB_CLIENT_SECRET",
            "MEILISEARCH_URL",
            "MEILISEARCH_API_KEY",
        ] {
            if std::env::var(key).unwrap_or_default().trim().is_empty() {
                return Err(PermanentError::err(format!(
                    "{key} is required for catalog game import"
                )));
            }
        }
        if !Path::new(SCRIPT).is_file() {
            return Err(PermanentError::err(
                "The compiled game import CLI is missing; deploy the current worker image",
            ));
        }
        let secrets = [
            "DATABASE_URL",
            "IGDB_CLIENT_ID",
            "IGDB_CLIENT_SECRET",
            "MEILISEARCH_API_KEY",
        ]
        .into_iter()
        .filter_map(|key| std::env::var(key).ok())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
        let mut command = Command::new("/usr/local/bin/node");
        command
            .arg("--enable-source-maps")
            .arg(SCRIPT)
            .args(["--all", "--database-cursor", "--max-minutes", "330"])
            .env("IGDB_REQUEST_INTERVAL_MS", "1000")
            .current_dir("/app");
        super::run_command_with_spec(ctx, command, &secrets, &super::GAME_IMPORT).await
    }
}

fn validate_payload(payload: &Value) -> Result<()> {
    if payload.as_object().is_none_or(|object| !object.is_empty()) {
        return Err(PermanentError::err(
            "catalog.games.import expects an empty payload",
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
    fn import_uses_an_independent_lock_and_fixed_payload() {
        assert_eq!(GameImportHandler.job_type(), JOB_TYPE);
        assert_eq!(
            GameImportHandler.concurrency_key(&json!({})),
            Some(CONCURRENCY_KEY.into())
        );
        assert_ne!(CONCURRENCY_KEY, super::super::CONCURRENCY_KEY);
        assert!(validate_payload(&json!({})).is_ok());
        for invalid in [json!(null), json!([]), json!({"cursor": 1})] {
            assert!(is_permanent(&validate_payload(&invalid).unwrap_err()));
        }
    }
}
