//! Search index jobs: `search.reindex` (full rebuild + index swap) and
//! `search.sync` (fill in missing documents; escalates to a full rebuild when
//! an index is missing or its settings are outdated). Both share the
//! concurrency key `search.index`, so they never run at the same time.

pub mod backend;
pub mod full;
pub mod indexes;
pub mod mappers;
pub mod settings;
pub mod source;
pub mod strip_mdx;
pub mod sync;

#[cfg(test)]
pub(crate) mod fake;
#[cfg(test)]
mod tests;

use std::sync::Arc;

use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::Utc;
use serde_json::Value;

use self::backend::{MeilisearchClient, SearchBackend, settings_match};
use self::indexes::INDEXES;
use self::source::PgSource;
use crate::config::MeilisearchConfig;
use crate::context::{JobContext, JobIo};
use crate::handler::{JobHandler, JobOutcome, PermanentError};
use crate::queue::LogLevel;
use crate::telemetry::log_safe;

/// Documents per source query and Meilisearch write.
pub const BATCH_SIZE: usize = 500;
/// Info log every N batches (10 000 documents) within an index.
pub const LOG_EVERY_BATCHES: u64 = 20;
/// Shared by every job that writes search indexes: both search jobs, the
/// movie search job and the game popularity refresh (must match the API's
/// job-type allowlist).
pub const CONCURRENCY_KEY: &str = "search.index";

/// Writes one batch and waits for Meilisearch to index it. A rejected batch
/// (Meilisearch fails the whole task for one invalid document) is logged and
/// fails the job.
pub(crate) async fn import_batch(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    index: &str,
    label: &str,
    docs: &[Value],
) -> Result<()> {
    if let Err(error) = backend.add_documents(index, docs).await {
        io.log(
            LogLevel::Error,
            &format!(
                "{label}: batch of {} documents rejected: {}",
                docs.len(),
                log_safe(&error)
            ),
        )
        .await;
        return Err(error)
            .with_context(|| format!("{label}: {} documents failed to import", docs.len()));
    }
    Ok(())
}

/// The Meilisearch config, or a permanent error when search is not set up.
pub(crate) fn meilisearch_config(config: &Option<MeilisearchConfig>) -> Result<&MeilisearchConfig> {
    config.as_ref().ok_or_else(|| {
        PermanentError::err(
            "Meilisearch is not configured (set MEILISEARCH_URL and MEILISEARCH_API_KEY)",
        )
    })
}

pub(crate) fn meilisearch(config: &Option<MeilisearchConfig>) -> Result<MeilisearchClient> {
    MeilisearchClient::new(meilisearch_config(config)?)
}

fn check_payload(payload: &Value) -> Result<()> {
    full::validate_payload(payload).map_err(|e| PermanentError::err(e.to_string()))
}

/// Why the live indexes cannot be synced incrementally: the first stable
/// index that is missing or whose settings differ from the versioned file.
pub async fn rebuild_reason(backend: &dyn SearchBackend) -> Result<Option<String>> {
    for spec in INDEXES.iter() {
        match backend.settings(spec.name).await? {
            None => return Ok(Some(format!("index {} does not exist", spec.name))),
            Some(actual) if !settings_match(&actual, &spec.settings()) => {
                return Ok(Some(format!("index {} has outdated settings", spec.name)));
            }
            Some(_) => {}
        }
    }
    Ok(None)
}

fn full_checkpoint(ctx: &JobContext) -> Option<full::FullCheckpoint> {
    match ctx.checkpoint_as::<full::FullCheckpoint>() {
        Ok(cp) => cp,
        Err(error) => {
            let cause: &(dyn std::error::Error + 'static) = error.as_ref();
            let stack = crate::telemetry::application_stack(error.backtrace());
            tracing::warn!(
                application_event = "job_checkpoint_invalid",
                job_id = %ctx.job_id(),
                error = cause,
                origin_stack = stack.as_deref(),
                "Checkpoint could not be decoded. Starting a fresh reindex"
            );
            None
        }
    }
}

pub struct SearchReindexHandler {
    pub meilisearch: Arc<Option<MeilisearchConfig>>,
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
        let backend = meilisearch(&self.meilisearch)?;
        let source = PgSource {
            pool: ctx.pool().clone(),
        };
        let had_checkpoint = ctx.checkpoint().is_some();
        let checkpoint = full_checkpoint(ctx);
        if had_checkpoint && checkpoint.is_none() {
            ctx.warn("checkpoint not understood; starting a fresh reindex")
                .await;
        }
        full::run(ctx, &backend, &source, checkpoint, Utc::now()).await
    }
}

pub struct SearchSyncHandler {
    pub meilisearch: Arc<Option<MeilisearchConfig>>,
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
        let backend = meilisearch(&self.meilisearch)?;
        let source = PgSource {
            pool: ctx.pool().clone(),
        };
        // A sync that escalated to a full rebuild resumes that rebuild.
        if let Ok(Some(cp)) = ctx.checkpoint_as::<full::FullCheckpoint>() {
            return full::run(ctx, &backend, &source, Some(cp), Utc::now()).await;
        }
        if let Some(reason) = rebuild_reason(&backend).await? {
            ctx.log(
                LogLevel::Warn,
                &format!("{reason}; running a full rebuild instead of a sync"),
            )
            .await;
            return full::run(ctx, &backend, &source, None, Utc::now()).await;
        }
        let checkpoint = ctx.checkpoint_as::<sync::SyncCheckpoint>().unwrap_or(None);
        sync::run(ctx, &backend, &source, checkpoint).await
    }
}
