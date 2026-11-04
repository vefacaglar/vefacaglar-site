//! The worker process: claims jobs one at a time, runs their handler and
//! finalizes them; side tasks keep heartbeats, LISTEN wake-ups, the reaper and
//! the scheduler going.

use std::sync::Arc;
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use sqlx::postgres::PgListener;
use tokio::sync::{Mutex, Notify};
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::backoff::retry_delay;
use crate::config::Config;
use crate::context::{JobContext, JobFlags};
use crate::handler::{JobOutcome, Registry, is_permanent};
use crate::queue::{self, ClaimedJob, LogLevel};
use crate::{health, scheduler};

/// Poll fallback when no NOTIFY arrives.
pub const POLL_INTERVAL: Duration = Duration::from_secs(5);
/// Heartbeat for running jobs and the `workers` row.
pub const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(10);
/// Reaper + scheduler cadence.
pub const MAINTENANCE_INTERVAL: Duration = Duration::from_secs(30);
/// After shutdown starts, how long a handler may take to reach its next batch
/// boundary before it is aborted (its last checkpoint is still kept). Leaves
/// headroom inside the 120 s container stop grace period.
pub const SHUTDOWN_DEADLINE: Duration = Duration::from_secs(90);

#[derive(Clone)]
struct ActiveJob {
    id: Uuid,
    flags: Arc<JobFlags>,
}

pub struct Worker {
    pool: PgPool,
    config: Config,
    registry: Arc<Registry>,
    shutdown: CancellationToken,
    started_at: DateTime<Utc>,
    version: String,
    active: Arc<Mutex<Option<ActiveJob>>>,
    wake: Arc<Notify>,
}

impl Worker {
    pub fn new(
        pool: PgPool,
        config: Config,
        registry: Registry,
        shutdown: CancellationToken,
    ) -> Self {
        Self {
            pool,
            config,
            registry: Arc::new(registry),
            shutdown,
            started_at: Utc::now(),
            version: crate::version(),
            active: Arc::new(Mutex::new(None)),
            wake: Arc::new(Notify::new()),
        }
    }

    pub async fn run(self) -> sqlx::Result<()> {
        let types = self.registry.job_types();
        tracing::info!(
            application_event = "worker_starting",
            worker_id = %self.config.worker_id,
            version = %self.version,
            job_types = ?types,
            "worker starting"
        );

        queue::upsert_worker(
            &self.pool,
            &self.config.worker_id,
            &self.config.hostname,
            &self.version,
            self.started_at,
        )
        .await?;
        if let Err(e) = health::write_heartbeat(&self.config.health_file) {
            tracing::warn!(application_event = "health_file_write_failed", error = %e, "cannot write health file");
        }

        // Side tasks stop on `tasks_stop`, which is cancelled only after the
        // current job has been finalized, so heartbeats continue meanwhile.
        let tasks_stop = CancellationToken::new();
        let side_tasks = vec![
            self.spawn_heartbeat(tasks_stop.clone()),
            self.spawn_listener(tasks_stop.clone()),
            self.spawn_maintenance(),
        ];

        self.claim_loop(&types).await;

        tasks_stop.cancel();
        for task in side_tasks {
            let _ = task.await;
        }
        health::remove(&self.config.health_file);
        tracing::info!(application_event = "worker_stopped", "worker stopped");
        Ok(())
    }

    async fn claim_loop(&self, types: &[String]) {
        let mut db_errors: u32 = 0;
        while !self.shutdown.is_cancelled() {
            match queue::claim(&self.pool, &self.config.worker_id, types).await {
                Ok(Some(job)) => {
                    db_errors = 0;
                    self.run_job(job).await;
                    continue;
                }
                Ok(None) => db_errors = 0,
                Err(e) => {
                    db_errors = db_errors.saturating_add(1);
                    tracing::error!(application_event = "job_claim_failed", error = %e, "failed to claim a job");
                }
            }
            let wait = if db_errors > 0 {
                POLL_INTERVAL * db_errors.min(6)
            } else {
                POLL_INTERVAL
            };
            tokio::select! {
                _ = self.shutdown.cancelled() => break,
                _ = self.wake.notified() => {}
                _ = tokio::time::sleep(wait) => {}
            }
        }
    }

    async fn run_job(&self, job: ClaimedJob) {
        let job_id = job.id;
        let worker_id = self.config.worker_id.clone();
        let Some(handler) = self.registry.get(&job.job_type) else {
            // Unreachable thanks to the claim filter; fail loudly if it happens.
            let msg = format!("no handler registered for job type {}", job.job_type);
            let _ = queue::mark_failed(&self.pool, job_id, &worker_id, &msg, Duration::ZERO, true)
                .await;
            return;
        };

        let flags = Arc::new(JobFlags::default());
        *self.active.lock().await = Some(ActiveJob {
            id: job_id,
            flags: flags.clone(),
        });

        let resuming = job.checkpoint.as_ref().is_some_and(|c| !c.is_null());
        let attempt = job.attempts;
        let max_attempts = job.max_attempts;
        let ctx = Arc::new(JobContext::new(
            job,
            self.pool.clone(),
            worker_id.clone(),
            self.shutdown.clone(),
            flags.clone(),
        ));
        ctx.info(format!(
            "{} (attempt {attempt}/{max_attempts}) on worker {worker_id}",
            if resuming {
                "resumed from checkpoint"
            } else {
                "started"
            }
        ))
        .await;

        let started = Instant::now();
        let task_ctx = ctx.clone();
        let mut task = tokio::spawn(async move { handler.run(&task_ctx).await });
        let shutdown = self.shutdown.clone();
        let deadline = async move {
            shutdown.cancelled().await;
            tokio::time::sleep(SHUTDOWN_DEADLINE).await;
        };

        let result = tokio::select! {
            joined = &mut task => match joined {
                Ok(result) => Some(result),
                Err(e) => Some(Err(anyhow::anyhow!("handler panicked: {e}"))),
            },
            _ = deadline => {
                task.abort();
                None
            }
        };
        let elapsed = started.elapsed().as_secs();

        if flags.lock_lost.load(Ordering::SeqCst) {
            tracing::warn!(application_event = "job_lease_lost", %job_id, "job was reaped while running; leaving it to its new owner");
        } else {
            self.finalize(&ctx, result, attempt, elapsed).await;
        }
        *self.active.lock().await = None;
    }

    async fn finalize(
        &self,
        ctx: &JobContext,
        result: Option<Result<JobOutcome>>,
        attempt: i32,
        elapsed: u64,
    ) {
        let job_id = ctx.job_id();
        let worker_id = &self.config.worker_id;
        let pool = &self.pool;
        let outcome = match result {
            Some(Ok(JobOutcome::Completed)) => {
                queue::mark_succeeded(pool, job_id, worker_id, &format!("succeeded in {elapsed}s"))
                    .await
                    .map(|_| ())
            }
            Some(Ok(JobOutcome::Interrupted)) if ctx.is_cancel_requested() => {
                queue::mark_cancelled(
                    pool,
                    job_id,
                    worker_id,
                    &format!("cancelled after {elapsed}s"),
                )
                .await
                .map(|_| ())
            }
            Some(Ok(JobOutcome::Interrupted)) => queue::requeue_for_shutdown(
                pool,
                job_id,
                worker_id,
                LogLevel::Info,
                "paused for shutdown; will resume from checkpoint",
            )
            .await
            .map(|_| ()),
            None => queue::requeue_for_shutdown(
                pool,
                job_id,
                worker_id,
                LogLevel::Warn,
                "paused for shutdown (deadline reached); will resume from the last checkpoint",
            )
            .await
            .map(|_| ()),
            Some(Err(error)) => {
                let message = format!("{error:#}");
                let permanent = is_permanent(&error);
                let delay = retry_delay(attempt);
                match queue::mark_failed(pool, job_id, worker_id, &message, delay, permanent).await
                {
                    Ok(result) => {
                        tracing::error!(application_event = "job_attempt_failed", %job_id, ?result, error = %message, "job attempt failed");
                        Ok(())
                    }
                    Err(e) => Err(e),
                }
            }
        };
        if let Err(e) = outcome {
            // The reaper will pick the job up again once heartbeats stop.
            tracing::error!(application_event = "job_finalize_failed", %job_id, error = %e, "failed to finalize job");
        }
    }

    fn spawn_heartbeat(&self, stop: CancellationToken) -> JoinHandle<()> {
        let pool = self.pool.clone();
        let config = self.config.clone();
        let version = self.version.clone();
        let started_at = self.started_at;
        let active = self.active.clone();
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(HEARTBEAT_INTERVAL);
            ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
            loop {
                tokio::select! {
                    _ = stop.cancelled() => break,
                    _ = ticker.tick() => {}
                }
                let current = active.lock().await.clone();
                if let Some(job) = current {
                    match queue::heartbeat_job(&pool, job.id, &config.worker_id).await {
                        Ok(held) => job.flags.apply(held),
                        Err(e) => {
                            tracing::warn!(application_event = "job_heartbeat_failed", job_id = %job.id, error = %e, "job heartbeat failed")
                        }
                    }
                }
                match queue::upsert_worker(
                    &pool,
                    &config.worker_id,
                    &config.hostname,
                    &version,
                    started_at,
                )
                .await
                {
                    Ok(()) => {
                        if let Err(e) = health::write_heartbeat(&config.health_file) {
                            tracing::warn!(application_event = "health_file_write_failed", error = %e, "cannot write health file");
                        }
                    }
                    Err(e) => {
                        tracing::warn!(application_event = "worker_heartbeat_failed", error = %e, "worker heartbeat failed")
                    }
                }
            }
        })
    }

    fn spawn_listener(&self, stop: CancellationToken) -> JoinHandle<()> {
        let pool = self.pool.clone();
        let wake = self.wake.clone();
        tokio::spawn(async move {
            while !stop.is_cancelled() {
                let mut listener = match PgListener::connect_with(&pool).await {
                    Ok(l) => l,
                    Err(e) => {
                        tracing::warn!(application_event = "job_listener_connect_failed", error = %e, "LISTEN connection failed; polling only");
                        tokio::select! {
                            _ = stop.cancelled() => break,
                            _ = tokio::time::sleep(POLL_INTERVAL * 6) => continue,
                        }
                    }
                };
                if let Err(e) = listener.listen("jobs").await {
                    tracing::warn!(application_event = "job_listener_subscribe_failed", error = %e, "LISTEN jobs failed; polling only");
                    tokio::select! {
                        _ = stop.cancelled() => break,
                        _ = tokio::time::sleep(POLL_INTERVAL * 6) => continue,
                    }
                }
                tracing::debug!("listening on channel jobs");
                loop {
                    tokio::select! {
                        _ = stop.cancelled() => return,
                        received = listener.recv() => match received {
                            Ok(notification) => {
                                tracing::debug!(job_id = notification.payload(), "job notification");
                                wake.notify_one();
                            }
                            Err(e) => {
                                tracing::warn!(application_event = "job_listener_disconnected", error = %e, "LISTEN connection lost; reconnecting");
                                break;
                            }
                        }
                    }
                }
                tokio::select! {
                    _ = stop.cancelled() => break,
                    _ = tokio::time::sleep(POLL_INTERVAL) => {}
                }
            }
        })
    }

    /// Reaper, scheduler and worker-row pruning. Stops claiming new work as
    /// soon as shutdown begins (nothing here is needed to finish a job).
    fn spawn_maintenance(&self) -> JoinHandle<()> {
        let pool = self.pool.clone();
        let registry = self.registry.clone();
        let shutdown = self.shutdown.clone();
        let wake = self.wake.clone();
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(MAINTENANCE_INTERVAL);
            ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
            loop {
                tokio::select! {
                    _ = shutdown.cancelled() => break,
                    _ = ticker.tick() => {}
                }
                match queue::reap_stale(&pool).await {
                    Ok(ids) if !ids.is_empty() => {
                        tracing::warn!(application_event = "stale_jobs_requeued", count = ids.len(), job_ids = ?ids, "re-queued jobs of lost workers");
                        wake.notify_one();
                    }
                    Ok(_) => {}
                    Err(e) => {
                        tracing::error!(application_event = "job_reaper_failed", error = %e, "reaper failed")
                    }
                }
                if let Err(e) = scheduler::tick(&pool, &registry).await {
                    tracing::error!(application_event = "job_scheduler_failed", error = %e, "scheduler failed");
                }
                if let Err(e) = queue::prune_workers(&pool).await {
                    tracing::warn!(application_event = "worker_prune_failed", error = %e, "pruning offline workers failed");
                }
            }
        })
    }
}
