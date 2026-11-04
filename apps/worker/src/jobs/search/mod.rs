//! Search index jobs: `search.reindex` (full rebuild + alias swap) and
//! `search.sync` (fill in missing documents). Both share the concurrency key
//! `search.index`, so they never run at the same time.

pub mod backend;
pub mod collections;
pub mod full;
pub mod mappers;
pub mod source;
pub mod strip_mdx;
pub mod sync;

#[cfg(test)]
mod tests;

use std::sync::Arc;

use anyhow::{Result, bail};
use async_trait::async_trait;
use chrono::Utc;
use serde_json::Value;

use self::backend::{SearchBackend, TypesenseClient};
use self::source::PgSource;
use crate::config::TypesenseConfig;
use crate::context::{JobContext, JobIo};
use crate::handler::{JobHandler, JobOutcome, PermanentError};
use crate::queue::LogLevel;

/// Documents per source query and Typesense import.
pub const BATCH_SIZE: usize = 500;
/// Info log every N batches (10 000 documents) within a collection.
pub const LOG_EVERY_BATCHES: u64 = 20;
/// Shared by both search jobs (must match the API's job-type allowlist).
pub const CONCURRENCY_KEY: &str = "search.index";
/// Sample size of per-document import errors written to the job log.
const MAX_LOGGED_FAILURES: usize = 5;

/// Imports one batch; any rejected document is logged and fails the job.
pub(crate) async fn import_batch(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    collection: &str,
    label: &str,
    docs: &[Value],
) -> Result<()> {
    let failures = backend.import(collection, docs).await?;
    if failures.is_empty() {
        return Ok(());
    }
    for failure in failures.iter().take(MAX_LOGGED_FAILURES) {
        io.log(
            LogLevel::Error,
            &format!(
                "{label}: document {} rejected: {}",
                failure.id.as_deref().unwrap_or("?"),
                failure.error
            ),
        )
        .await;
    }
    bail!(
        "{label}: {}/{} documents failed to import (first error: {})",
        failures.len(),
        docs.len(),
        failures[0].error
    )
}

fn typesense(config: &Option<TypesenseConfig>) -> Result<TypesenseClient> {
    match config {
        Some(config) => TypesenseClient::new(config),
        None => Err(PermanentError::err(
            "Typesense is not configured (set TYPESENSE_HOST and TYPESENSE_API_KEY)",
        )),
    }
}

fn check_payload(payload: &Value) -> Result<()> {
    full::validate_payload(payload).map_err(|e| PermanentError::err(e.to_string()))
}

pub struct SearchReindexHandler {
    pub typesense: Arc<Option<TypesenseConfig>>,
}

#[async_trait]
impl JobHandler for SearchReindexHandler {
    fn job_type(&self) -> &'static str {
        "search.reindex"
    }

    fn concurrency_key(&self, _payload: &Value) -> Option<String> {
        Some(CONCURRENCY_KEY.to_string())
    }

    async fn run(&self, ctx: &JobContext) -> Result<JobOutcome> {
        check_payload(ctx.payload())?;
        let backend = typesense(&self.typesense)?;
        let source = PgSource {
            pool: ctx.pool().clone(),
        };
        let checkpoint = match ctx.checkpoint_as::<full::FullCheckpoint>() {
            Ok(cp) => cp,
            Err(_) => {
                ctx.warn("checkpoint not understood; starting a fresh reindex")
                    .await;
                None
            }
        };
        full::run(ctx, &backend, &source, checkpoint, Utc::now()).await
    }
}

pub struct SearchSyncHandler {
    pub typesense: Arc<Option<TypesenseConfig>>,
}

#[async_trait]
impl JobHandler for SearchSyncHandler {
    fn job_type(&self) -> &'static str {
        "search.sync"
    }

    fn concurrency_key(&self, _payload: &Value) -> Option<String> {
        Some(CONCURRENCY_KEY.to_string())
    }

    async fn run(&self, ctx: &JobContext) -> Result<JobOutcome> {
        check_payload(ctx.payload())?;
        let backend = typesense(&self.typesense)?;
        let source = PgSource {
            pool: ctx.pool().clone(),
        };
        let checkpoint = ctx.checkpoint_as::<sync::SyncCheckpoint>().unwrap_or(None);
        sync::run(ctx, &backend, &source, checkpoint).await
    }
}
