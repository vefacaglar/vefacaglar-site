//! Fixed Node entrypoints own TV provider requests and atomic canonical writes.
use crate::context::JobContext;
use crate::handler::{JobHandler, JobOutcome, PermanentError};
use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use std::path::Path;
use tokio::process::Command;
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
    let mut command = Command::new("/usr/local/bin/node");
    command
        .arg("--enable-source-maps")
        .arg(script)
        .current_dir("/app");
    super::run_command_with_spec(ctx, command, &secrets, spec).await
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
    fn isolated_locks_empty_payload_and_bounded_continuations() {
        assert_eq!(TvCatalogHandler.job_type(), "catalog.tv-series.sync");
        assert_eq!(TvCastHandler.job_type(), "catalog.tv-series.cast.refresh");
        assert_eq!(
            TvCastHandler.concurrency_key(&json!({})),
            Some("catalog.tv-series.cast".into())
        );
        assert!(
            super::super::movies::parse_continuation(
                r#"[catalog:tv-cast] result {"hasMore":true,"progressMade":true,"nextRunAt":null}"#,
                super::super::TV_CAST.prefix
            )
            .unwrap()
            .unwrap()
            .is_some()
        );
        assert_eq!(
            TvSearchHandler.concurrency_key(&json!({})),
            Some("search.tv-series.index".into())
        );
        assert_ne!(
            TvCatalogHandler.concurrency_key(&json!({})),
            TvPopularityHandler.concurrency_key(&json!({}))
        );
        for payload in [json!(null), json!([]), json!({"id":1})] {
            assert!(validate_payload(&payload).is_err());
        }
        assert!(validate_payload(&json!({})).is_ok());
        assert!(super::super::movies::parse_continuation(r#"[catalog:tv-series] result {"hasMore":true,"progressMade":true,"nextRunAt":null}"#, super::super::TV_CATALOG.prefix).unwrap().unwrap().is_some());
        assert!(super::super::movies::parse_continuation(r#"[search:tv-series] result {"hasMore":false,"progressMade":true,"nextRunAt":null}"#, super::super::TV_SEARCH.prefix).unwrap().is_some());
    }
}
