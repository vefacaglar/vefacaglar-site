//! All SQL against the job tables. Runtime queries only (no `query!` macros),
//! so building the worker never needs a database.
//!
//! Every write the dashboard cares about (status change, progress/checkpoint,
//! job_logs insert) emits `pg_notify('job_events', <job id>)` in the same
//! statement or transaction, so listeners only hear about committed changes.

use std::time::Duration;

use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::context::Progress;

/// Seconds without a heartbeat after which a running job is considered lost.
pub const STALE_AFTER_SECS: i64 = 60;

/// Channel for live dashboard updates; payload = job id.
pub const JOB_EVENTS_CHANNEL: &str = "job_events";
/// Channel the API notifies on enqueue; payload = job id.
pub const JOBS_CHANNEL: &str = "jobs";

/// Appended to `FROM <cte> c` so the statement notifies once per affected row.
const NOTIFY_LATERAL: &str = ", LATERAL (SELECT pg_notify('job_events', c.id::text)) AS n";

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct ClaimedJob {
    pub id: Uuid,
    #[sqlx(rename = "type")]
    pub job_type: String,
    pub payload: Value,
    pub checkpoint: Option<Value>,
    pub attempts: i32,
    pub max_attempts: i32,
    pub cancel_requested: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Warn => "warn",
            Self::Error => "error",
        }
    }
}

/// Claims the next due job of a handled type (spec "Claim" query, restricted
/// to `types` so jobs of unknown types stay visible as queued).
pub async fn claim(
    pool: &PgPool,
    worker_id: &str,
    types: &[String],
) -> sqlx::Result<Option<ClaimedJob>> {
    sqlx::query_as::<_, ClaimedJob>(&format!(
        "WITH c AS ( \
             UPDATE jobs SET status = 'running', locked_by = $1, locked_at = now(), heartbeat_at = now(), \
                 started_at = coalesce(started_at, now()), attempts = attempts + 1, updated_at = now() \
             WHERE id = ( \
                 SELECT id FROM jobs \
                 WHERE status = 'queued' AND run_at <= now() AND type = ANY($2) \
                 ORDER BY run_at, created_at \
                 FOR UPDATE SKIP LOCKED \
                 LIMIT 1 \
             ) \
             RETURNING id, type, payload, checkpoint, attempts, max_attempts, cancel_requested \
         ) \
         SELECT c.id, c.type, c.payload, c.checkpoint, c.attempts, c.max_attempts, c.cancel_requested \
         FROM c{NOTIFY_LATERAL}"
    ))
    .bind(worker_id)
    .bind(types)
    .fetch_optional(pool)
    .await
}

/// Inserts one job_logs row and notifies, in one statement.
pub async fn insert_log(
    pool: &PgPool,
    job_id: Uuid,
    level: LogLevel,
    message: &str,
) -> sqlx::Result<()> {
    insert_logs(pool, job_id, &[(level, message)]).await
}

/// Inserts several job_logs rows with a single notify.
pub async fn insert_logs(
    pool: &PgPool,
    job_id: Uuid,
    lines: &[(LogLevel, &str)],
) -> sqlx::Result<()> {
    if lines.is_empty() {
        return Ok(());
    }
    let levels: Vec<&str> = lines.iter().map(|(l, _)| l.as_str()).collect();
    let messages: Vec<&str> = lines.iter().map(|(_, m)| *m).collect();
    sqlx::query(
        "WITH i AS ( \
             INSERT INTO job_logs (job_id, level, message) \
             SELECT $1, l.level, l.message FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS l(level, message, ord) \
             ORDER BY l.ord \
             RETURNING job_id \
         ) \
         SELECT pg_notify('job_events', $1::text) WHERE EXISTS (SELECT 1 FROM i)",
    )
    .bind(job_id)
    .bind(&levels)
    .bind(&messages)
    .execute(pool)
    .await?;
    Ok(())
}

async fn insert_log_tx(
    tx: &mut Transaction<'_, Postgres>,
    job_id: Uuid,
    level: LogLevel,
    message: &str,
) -> sqlx::Result<()> {
    sqlx::query("INSERT INTO job_logs (job_id, level, message) VALUES ($1, $2, $3)")
        .bind(job_id)
        .bind(level.as_str())
        .bind(message)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn notify_tx(
    tx: &mut Transaction<'_, Postgres>,
    channel: &str,
    job_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query("SELECT pg_notify($1, $2)")
        .bind(channel)
        .bind(job_id.to_string())
        .execute(&mut **tx)
        .await?;
    Ok(())
}

/// Result of a guarded update on a job this worker holds.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Held {
    /// Still ours; carries the current `cancel_requested` flag.
    Yes { cancel_requested: bool },
    /// The job was reaped or otherwise taken away from this worker.
    Lost,
}

fn held(row: Option<(bool,)>) -> Held {
    match row {
        Some((cancel_requested,)) => Held::Yes { cancel_requested },
        None => Held::Lost,
    }
}

const HELD_BY_ME: &str = "id = $1 AND locked_by = $2 AND status = 'running'";

/// Heartbeats are frequent and carry no user-visible change: no notify.
pub async fn heartbeat_job(pool: &PgPool, job_id: Uuid, worker_id: &str) -> sqlx::Result<Held> {
    let row: Option<(bool,)> = sqlx::query_as(&format!(
        "UPDATE jobs SET heartbeat_at = now() WHERE {HELD_BY_ME} RETURNING cancel_requested"
    ))
    .bind(job_id)
    .bind(worker_id)
    .fetch_optional(pool)
    .await?;
    Ok(held(row))
}

pub async fn save_progress(
    pool: &PgPool,
    job_id: Uuid,
    worker_id: &str,
    progress: &Progress,
) -> sqlx::Result<Held> {
    let row: Option<(bool,)> = sqlx::query_as(&format!(
        "WITH c AS ( \
             UPDATE jobs SET progress = $3, heartbeat_at = now(), updated_at = now() \
             WHERE {HELD_BY_ME} RETURNING id, cancel_requested \
         ) \
         SELECT c.cancel_requested FROM c{NOTIFY_LATERAL}"
    ))
    .bind(job_id)
    .bind(worker_id)
    .bind(sqlx::types::Json(progress))
    .fetch_optional(pool)
    .await?;
    Ok(held(row))
}

/// Persists progress and checkpoint in a single UPDATE (spec "Checkpoint").
pub async fn save_checkpoint(
    pool: &PgPool,
    job_id: Uuid,
    worker_id: &str,
    progress: &Progress,
    checkpoint: &Value,
) -> sqlx::Result<Held> {
    let row: Option<(bool,)> = sqlx::query_as(&format!(
        "WITH c AS ( \
             UPDATE jobs SET progress = $3, checkpoint = $4, heartbeat_at = now(), updated_at = now() \
             WHERE {HELD_BY_ME} RETURNING id, cancel_requested \
         ) \
         SELECT c.cancel_requested FROM c{NOTIFY_LATERAL}"
    ))
    .bind(job_id)
    .bind(worker_id)
    .bind(sqlx::types::Json(progress))
    .bind(checkpoint)
    .fetch_optional(pool)
    .await?;
    Ok(held(row))
}

/// Runs a guarded status UPDATE plus an optional log line in one transaction
/// and notifies once. Returns whether the job was still held by this worker.
async fn transition(
    pool: &PgPool,
    job_id: Uuid,
    worker_id: &str,
    set_clause: &str,
    log: Option<(LogLevel, &str)>,
) -> sqlx::Result<bool> {
    let mut tx = pool.begin().await?;
    let done = sqlx::query(&format!(
        "UPDATE jobs SET {set_clause}, updated_at = now() WHERE {HELD_BY_ME}"
    ))
    .bind(job_id)
    .bind(worker_id)
    .execute(&mut *tx)
    .await?;
    if done.rows_affected() != 1 {
        tx.rollback().await?;
        return Ok(false);
    }
    if let Some((level, message)) = log {
        insert_log_tx(&mut tx, job_id, level, message).await?;
    }
    notify_tx(&mut tx, JOB_EVENTS_CHANNEL, job_id).await?;
    tx.commit().await?;
    Ok(true)
}

pub async fn mark_succeeded(
    pool: &PgPool,
    job_id: Uuid,
    worker_id: &str,
    log: &str,
) -> sqlx::Result<bool> {
    transition(
        pool,
        job_id,
        worker_id,
        "status = 'succeeded', finished_at = now(), checkpoint = NULL, error = NULL, cancel_requested = false",
        Some((LogLevel::Info, log)),
    )
    .await
}

pub async fn mark_cancelled(
    pool: &PgPool,
    job_id: Uuid,
    worker_id: &str,
    log: &str,
) -> sqlx::Result<bool> {
    transition(
        pool,
        job_id,
        worker_id,
        "status = 'cancelled', finished_at = now()",
        Some((LogLevel::Warn, log)),
    )
    .await
}

/// Graceful shutdown: back to `queued` with the checkpoint kept. The attempt
/// counter is rolled back because a deploy is not a failure.
pub async fn requeue_for_shutdown(
    pool: &PgPool,
    job_id: Uuid,
    worker_id: &str,
    level: LogLevel,
    log: &str,
) -> sqlx::Result<bool> {
    transition(
        pool,
        job_id,
        worker_id,
        "status = 'queued', locked_by = NULL, locked_at = NULL, attempts = GREATEST(attempts - 1, 0)",
        Some((level, log)),
    )
    .await
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FailureResult {
    Retrying,
    Failed,
    Lost,
}

/// Records a failed attempt: re-queued with backoff while attempts remain
/// (checkpoint kept), otherwise `failed`. Writes the matching log line and
/// notifies in the same transaction.
pub async fn mark_failed(
    pool: &PgPool,
    job_id: Uuid,
    worker_id: &str,
    error: &str,
    retry_in: Duration,
    permanent: bool,
) -> sqlx::Result<FailureResult> {
    let mut tx = pool.begin().await?;
    let row: Option<(String,)> = sqlx::query_as(&format!(
        "UPDATE jobs SET \
             status = CASE WHEN NOT $5 AND attempts < max_attempts THEN 'queued' ELSE 'failed' END, \
             run_at = CASE WHEN NOT $5 AND attempts < max_attempts THEN now() + make_interval(secs => $4) ELSE run_at END, \
             finished_at = CASE WHEN NOT $5 AND attempts < max_attempts THEN NULL ELSE now() END, \
             locked_by = CASE WHEN NOT $5 AND attempts < max_attempts THEN NULL ELSE locked_by END, \
             locked_at = CASE WHEN NOT $5 AND attempts < max_attempts THEN NULL ELSE locked_at END, \
             error = $3, updated_at = now() \
         WHERE {HELD_BY_ME} RETURNING status"
    ))
    .bind(job_id)
    .bind(worker_id)
    .bind(error)
    .bind(retry_in.as_secs_f64())
    .bind(permanent)
    .fetch_optional(&mut *tx)
    .await?;
    let result = match row.as_ref().map(|r| r.0.as_str()) {
        Some("queued") => FailureResult::Retrying,
        Some(_) => FailureResult::Failed,
        None => {
            tx.rollback().await?;
            return Ok(FailureResult::Lost);
        }
    };
    let message = match result {
        FailureResult::Retrying => format!("failed: {error}; retrying in {}s", retry_in.as_secs()),
        _ if permanent => format!("failed permanently: {error}"),
        _ => format!("failed: {error}"),
    };
    insert_log_tx(&mut tx, job_id, LogLevel::Error, &message).await?;
    notify_tx(&mut tx, JOB_EVENTS_CHANNEL, job_id).await?;
    tx.commit().await?;
    Ok(result)
}

/// Re-queues running jobs whose worker stopped heartbeating (checkpoint kept,
/// so they resume). Jobs that already used every attempt are failed instead,
/// so a job that crashes its worker cannot loop forever. Returns reaped ids.
pub async fn reap_stale(pool: &PgPool) -> sqlx::Result<Vec<Uuid>> {
    let rows: Vec<(Uuid,)> = sqlx::query_as(&format!(
        "WITH c AS ( \
             UPDATE jobs SET \
                 status = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END, \
                 finished_at = CASE WHEN attempts < max_attempts THEN NULL ELSE now() END, \
                 error = CASE WHEN attempts < max_attempts THEN error ELSE 'worker lost and no attempts left' END, \
                 locked_by = NULL, locked_at = NULL, updated_at = now() \
             WHERE status = 'running' \
               AND (heartbeat_at IS NULL OR heartbeat_at < now() - make_interval(secs => $1)) \
             RETURNING id, status \
         ), logs AS ( \
             INSERT INTO job_logs (job_id, level, message) \
             SELECT id, \
                    CASE WHEN status = 'queued' THEN 'warn' ELSE 'error' END, \
                    CASE WHEN status = 'queued' THEN 'worker lost, resuming from checkpoint' \
                         ELSE 'worker lost and no attempts left; marked failed' END \
             FROM c \
         ) \
         SELECT c.id FROM c{NOTIFY_LATERAL}"
    ))
    .bind(STALE_AFTER_SECS as f64)
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

pub async fn upsert_worker(
    pool: &PgPool,
    worker_id: &str,
    hostname: &str,
    version: &str,
    started_at: chrono::DateTime<chrono::Utc>,
) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO workers (id, hostname, version, started_at, last_seen_at) \
         VALUES ($1, $2, $3, $4, now()) \
         ON CONFLICT (id) DO UPDATE SET hostname = EXCLUDED.hostname, version = EXCLUDED.version, \
             started_at = EXCLUDED.started_at, last_seen_at = now()",
    )
    .bind(worker_id)
    .bind(hostname)
    .bind(version)
    .bind(started_at)
    .execute(pool)
    .await?;
    Ok(())
}

/// Drops rows of workers offline for a day (worker ids change on every
/// deploy, so the table would otherwise grow forever).
pub async fn prune_workers(pool: &PgPool) -> sqlx::Result<u64> {
    let done = sqlx::query("DELETE FROM workers WHERE last_seen_at < now() - interval '1 day'")
        .execute(pool)
        .await?;
    Ok(done.rows_affected())
}

/// Inserts a job unless an active job holds the same concurrency key (the
/// partial unique index turns that into a no-op). Notifies `jobs` (workers)
/// and `job_events` (dashboard) on commit.
pub async fn enqueue_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    job_type: &str,
    payload: &Value,
    concurrency_key: Option<&str>,
    recurring_job_id: Option<&str>,
) -> sqlx::Result<Option<Uuid>> {
    let row: Option<(Uuid,)> = sqlx::query_as(
        "INSERT INTO jobs (type, payload, concurrency_key, recurring_job_id) \
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id",
    )
    .bind(job_type)
    .bind(payload)
    .bind(concurrency_key)
    .bind(recurring_job_id)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some((id,)) = row {
        let message = match recurring_job_id {
            Some(r) => format!("enqueued by recurring job {r}"),
            None => "enqueued".to_string(),
        };
        insert_log_tx(tx, id, LogLevel::Info, &message).await?;
        notify_tx(tx, JOBS_CHANNEL, id).await?;
        notify_tx(tx, JOB_EVENTS_CHANNEL, id).await?;
    }
    Ok(row.map(|r| r.0))
}
