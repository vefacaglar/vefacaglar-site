//! Fixed Node entrypoints own TV provider requests and atomic canonical writes.
use crate::context::JobContext;
use crate::handler::{JobHandler, JobOutcome, PermanentError};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use std::path::Path;
use tokio::process::Command;
pub const JOB_TYPES: [&str; 4] = [
    "catalog.tv-series.sync",
    "catalog.tv-series.cast.refresh",
    "catalog.tv-series.popularity.refresh",
    "search.tv-series.sync",
];
pub struct TvCatalogHandler;
pub struct TvCastHandler;
pub struct TvPopularityHandler;
pub struct TvSearchHandler;
fn validate_payload(payload: &Value) -> Result<()> {
    if payload.as_object().is_none_or(|value| !value.is_empty()) {
        return Err(PermanentError::err("TV jobs expect an empty payload"));
    }
    Ok(())
}
async fn run(
    ctx: &JobContext,
    script: &'static str,
    spec: &'static super::CliSpec,
    search: bool,
) -> Result<JobOutcome> {
    validate_payload(ctx.payload())?;
    let keys: &[&str] = if search {
        &["DATABASE_URL", "MEILISEARCH_URL", "MEILISEARCH_API_KEY"]
    } else {
        &["DATABASE_URL"]
    };
    for key in keys {
        if std::env::var(key).unwrap_or_default().trim().is_empty() {
            return Err(PermanentError::err(format!(
                "{key} is required for this TV job"
            )));
        }
    }
    if !Path::new(script).is_file() {
        return Err(PermanentError::err(
            "The compiled TV CLI is missing; deploy the current worker image",
        ));
    }
    let secrets = ["DATABASE_URL", "MEILISEARCH_API_KEY"]
        .into_iter()
        .filter_map(|key| std::env::var(key).ok())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    let command = node_command(ctx, script);
    let result = super::run_command_with_spec(ctx, command, &secrets, spec).await;
    if ctx.should_stop() {
        Ok(JobOutcome::Interrupted)
    } else {
        result
    }
}
fn node_command(ctx: &JobContext, script: &str) -> Command {
    let mut command = Command::new("/usr/local/bin/node");
    command
        .arg("--enable-source-maps")
        .arg(script)
        .current_dir("/app")
        .env("VEFA_JOB_ID", ctx.job_id().to_string())
        .env("VEFA_JOB_WORKER_ID", ctx.worker_id());
    command
}
macro_rules! tv_handler {
    ($name:ident, $kind:literal, $key:literal, $file:literal, $spec:ident, $search:expr) => {
        #[async_trait]
        impl JobHandler for $name {
            fn job_type(&self) -> &'static str {
                $kind
            }
            fn concurrency_key(&self, _: &Value) -> Option<String> {
                Some($key.into())
            }
            async fn run(&self, ctx: &JobContext) -> Result<JobOutcome> {
                run(
                    ctx,
                    concat!("/app/apps/api/dist/scripts/", $file),
                    &super::$spec,
                    $search,
                )
                .await
            }
        }
    };
}
tv_handler!(
    TvCastHandler,
    "catalog.tv-series.cast.refresh",
    "catalog.tv-series.cast",
    "refresh-tv-cast.js",
    TV_CAST,
    false
);
tv_handler!(
    TvCatalogHandler,
    "catalog.tv-series.sync",
    "catalog.tv-series",
    "sync-tv-series.js",
    TV_CATALOG,
    false
);
tv_handler!(
    TvPopularityHandler,
    "catalog.tv-series.popularity.refresh",
    "catalog.tv-series.popularity",
    "refresh-tv-popularity.js",
    TV_POPULARITY,
    false
);
tv_handler!(
    TvSearchHandler,
    "search.tv-series.sync",
    "search.tv-series.index",
    "sync-tv-search.js",
    TV_SEARCH,
    true
);
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn isolated_locks_empty_payload_and_single_run_policies() {
        assert_eq!(TvCatalogHandler.job_type(), "catalog.tv-series.sync");
        assert_eq!(TvCastHandler.job_type(), "catalog.tv-series.cast.refresh");
        assert_eq!(
            TvCastHandler.concurrency_key(&json!({})),
            Some("catalog.tv-series.cast".into())
        );
        assert_eq!(
            TvSearchHandler.concurrency_key(&json!({})),
            Some("search.tv-series.index".into())
        );
        assert_ne!(
            TvCatalogHandler.concurrency_key(&json!({})),
            TvPopularityHandler.concurrency_key(&json!({}))
        );
        for payload in [json!(null), json!([]), json!({"id": 1})] {
            assert!(validate_payload(&payload).is_err());
        }
        assert!(validate_payload(&json!({})).is_ok());
        for spec in [
            &super::super::TV_CATALOG,
            &super::super::TV_CAST,
            &super::super::TV_POPULARITY,
            &super::super::TV_SEARCH,
        ] {
            assert!(
                spec.deadline.is_none(),
                "TV jobs can run across hours or days"
            );
            assert!(!spec.deadline_yields);
            assert!(!spec.continues, "TV output cannot create another job ID");
        }
    }
    #[tokio::test]
    async fn node_receives_the_stable_job_and_lease_owner() {
        use crate::context::JobFlags;
        use crate::queue::ClaimedJob;
        use std::sync::Arc;
        use tokio_util::sync::CancellationToken;
        use uuid::Uuid;
        let id = Uuid::new_v4();
        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://fixture@127.0.0.1/unused")
            .unwrap();
        let ctx = JobContext::new(
            ClaimedJob {
                id,
                job_type: JOB_TYPES[0].into(),
                payload: json!({}),
                checkpoint: None,
                attempts: 2,
                max_attempts: 3,
                cancel_requested: false,
            },
            pool,
            "fixture-worker".into(),
            CancellationToken::new(),
            Arc::new(JobFlags::default()),
        );
        let command = node_command(&ctx, "/app/apps/api/dist/scripts/sync-tv-series.js");
        let env = command
            .as_std()
            .get_envs()
            .map(|(key, value)| (key.to_str().unwrap(), value.unwrap().to_str().unwrap()))
            .collect::<std::collections::HashMap<_, _>>();
        assert_eq!(env["VEFA_JOB_ID"], id.to_string());
        assert_eq!(env["VEFA_JOB_WORKER_ID"], "fixture-worker");
    }
}
