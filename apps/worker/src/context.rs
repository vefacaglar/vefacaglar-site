use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::{Context as _, Result};
use async_trait::async_trait;
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use sqlx::PgPool;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::queue::{self, ClaimedJob, Held, LogLevel};

/// `jobs.progress`: `{ phase?, processed?, total?, message? }`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
pub struct Progress {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phase: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub processed: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Flags shared between the running handler, the heartbeat loop and the runner.
#[derive(Debug, Default)]
pub struct JobFlags {
    pub cancel_requested: AtomicBool,
    pub lock_lost: AtomicBool,
}

impl JobFlags {
    pub fn apply(&self, held: Held) {
        match held {
            Held::Yes { cancel_requested } => {
                if cancel_requested {
                    self.cancel_requested.store(true, Ordering::SeqCst);
                }
            }
            Held::Lost => self.lock_lost.store(true, Ordering::SeqCst),
        }
    }
}

/// The lock on the job was lost (reaped after missed heartbeats); the handler
/// must stop without touching the job again.
#[derive(Debug, thiserror::Error)]
#[error("job lock lost (reaped by another worker)")]
pub struct LockLost;

/// Everything a handler needs: payload/checkpoint plus progress, logging,
/// checkpointing and the stop signal (shutdown or cancel).
pub struct JobContext {
    job: ClaimedJob,
    pool: PgPool,
    worker_id: String,
    shutdown: CancellationToken,
    flags: Arc<JobFlags>,
}

impl JobContext {
    pub fn new(
        job: ClaimedJob,
        pool: PgPool,
        worker_id: String,
        shutdown: CancellationToken,
        flags: Arc<JobFlags>,
    ) -> Self {
        if job.cancel_requested {
            flags.cancel_requested.store(true, Ordering::SeqCst);
        }
        Self {
            job,
            pool,
            worker_id,
            shutdown,
            flags,
        }
    }

    pub fn job_id(&self) -> Uuid {
        self.job.id
    }

    pub fn attempt(&self) -> i32 {
        self.job.attempts
    }

    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    pub fn payload(&self) -> &Value {
        &self.job.payload
    }

    /// The raw checkpoint saved by a previous attempt, if any.
    pub fn checkpoint(&self) -> Option<&Value> {
        self.job.checkpoint.as_ref().filter(|v| !v.is_null())
    }

    /// Decodes the checkpoint. A checkpoint that no longer matches the
    /// handler's format is reported as `Err` so the handler can start over.
    pub fn checkpoint_as<T: DeserializeOwned>(&self) -> Result<Option<T>> {
        self.checkpoint()
            .map(|v| serde_json::from_value(v.clone()).context("invalid checkpoint"))
            .transpose()
    }

    /// True once shutdown started or a cancel was requested. Check between batches.
    pub fn should_stop(&self) -> bool {
        self.shutdown.is_cancelled() || self.is_cancel_requested() || self.is_lock_lost()
    }

    pub fn is_cancel_requested(&self) -> bool {
        self.flags.cancel_requested.load(Ordering::SeqCst)
    }

    pub fn is_shutting_down(&self) -> bool {
        self.shutdown.is_cancelled()
    }

    pub fn is_lock_lost(&self) -> bool {
        self.flags.lock_lost.load(Ordering::SeqCst)
    }

    /// Writes a `job_logs` line (and a tracing event). Logging failures are
    /// reported via tracing only, so they never fail the job.
    pub async fn log(&self, level: LogLevel, message: impl AsRef<str>) {
        let message = message.as_ref();
        match level {
            LogLevel::Info => {
                tracing::info!(job_id = %self.job.id, job_type = %self.job.job_type, "{message}")
            }
            LogLevel::Warn => {
                tracing::warn!(job_id = %self.job.id, job_type = %self.job.job_type, "{message}")
            }
            LogLevel::Error => {
                tracing::error!(job_id = %self.job.id, job_type = %self.job.job_type, "{message}")
            }
        }
        if let Err(e) = queue::insert_log(&self.pool, self.job.id, level, message).await {
            tracing::warn!(job_id = %self.job.id, error = %e, "failed to write job log");
        }
    }

    pub async fn info(&self, message: impl AsRef<str>) {
        self.log(LogLevel::Info, message).await
    }

    pub async fn warn(&self, message: impl AsRef<str>) {
        self.log(LogLevel::Warn, message).await
    }

    pub async fn error(&self, message: impl AsRef<str>) {
        self.log(LogLevel::Error, message).await
    }

    /// Updates `jobs.progress` only.
    pub async fn progress(&self, progress: &Progress) -> Result<()> {
        let held = queue::save_progress(&self.pool, self.job.id, &self.worker_id, progress).await?;
        self.after_update(held)
    }

    /// Persists progress and checkpoint together after a batch.
    pub async fn save_checkpoint<T: Serialize>(
        &self,
        progress: &Progress,
        checkpoint: &T,
    ) -> Result<()> {
        let value = serde_json::to_value(checkpoint).context("serialize checkpoint")?;
        let held =
            queue::save_checkpoint(&self.pool, self.job.id, &self.worker_id, progress, &value)
                .await?;
        self.after_update(held)
    }

    fn after_update(&self, held: Held) -> Result<()> {
        self.flags.apply(held);
        if held == Held::Lost {
            return Err(LockLost.into());
        }
        Ok(())
    }
}

/// The subset of [`JobContext`] job logic needs, as a trait so handlers can be
/// unit-tested with an in-memory fake.
#[async_trait]
pub trait JobIo: Send + Sync {
    /// Shutdown, cancel, or lost lock: stop at the next batch boundary.
    fn should_stop(&self) -> bool;
    fn is_cancel_requested(&self) -> bool;
    async fn log(&self, level: LogLevel, message: &str);
    async fn progress(&self, progress: &Progress) -> Result<()>;
    /// Persists progress + checkpoint (`Value::Null` clears the checkpoint).
    async fn checkpoint(&self, progress: &Progress, checkpoint: Value) -> Result<()>;
}

#[async_trait]
impl JobIo for JobContext {
    fn should_stop(&self) -> bool {
        JobContext::should_stop(self)
    }

    fn is_cancel_requested(&self) -> bool {
        JobContext::is_cancel_requested(self)
    }

    async fn log(&self, level: LogLevel, message: &str) {
        JobContext::log(self, level, message).await
    }

    async fn progress(&self, progress: &Progress) -> Result<()> {
        JobContext::progress(self, progress).await
    }

    async fn checkpoint(&self, progress: &Progress, checkpoint: Value) -> Result<()> {
        self.save_checkpoint(progress, &checkpoint).await
    }
}
