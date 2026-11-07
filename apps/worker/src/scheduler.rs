//! Recurring jobs: the 30 s tick that enqueues due runs.
//!
//! Rows are owned (and seeded) by the API's migrations. A row with a null
//! `cron` is a manual-only registered job: the scheduler never touches it; it
//! only runs via the dashboard's "run now".

use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::{PgPool, Postgres, Transaction};

use crate::cron::Schedule;
use crate::handler::Registry;
use crate::queue;

const MOVIE_SEARCH_SYNC: &str = "search.movies.sync";

#[derive(Debug, sqlx::FromRow)]
struct DueRecurring {
    id: String,
    #[sqlx(rename = "type")]
    job_type: String,
    cron: Option<String>,
    payload: Value,
    next_run_at: Option<DateTime<Utc>>,
}

/// What the scheduler does with one due definition (pure, for testing).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Decision {
    /// `cron` is null: manual-only, never scheduled.
    ManualOnly,
    /// `next_run_at` was null: only compute it.
    ScheduleOnly { next_run_at: DateTime<Utc> },
    /// Enqueue a job now and move `next_run_at` forward.
    Enqueue { next_run_at: DateTime<Utc> },
    /// The cron expression is invalid; leave the row alone.
    InvalidCron(String),
}

pub fn decide(
    cron: Option<&str>,
    next_run_at: Option<DateTime<Utc>>,
    now: DateTime<Utc>,
) -> Decision {
    let Some(cron) = cron else {
        return Decision::ManualOnly;
    };
    let schedule = match Schedule::parse(cron) {
        Ok(s) => s,
        Err(e) => return Decision::InvalidCron(e.to_string()),
    };
    // Missed runs (worker down for days) collapse into a single run: the next
    // occurrence is computed from now, not from the stale next_run_at.
    let next = match schedule.next_after(now) {
        Ok(n) => n,
        Err(e) => return Decision::InvalidCron(e.to_string()),
    };
    match next_run_at {
        None => Decision::ScheduleOnly { next_run_at: next },
        Some(_) => Decision::Enqueue { next_run_at: next },
    }
}

/// One scheduler pass. Rows are locked with `FOR NO KEY UPDATE SKIP LOCKED` so
/// several workers never enqueue the same run twice.
pub async fn tick(pool: &PgPool, registry: &Registry) -> sqlx::Result<()> {
    let mut tx = pool.begin().await?;
    let due: Vec<DueRecurring> = sqlx::query_as(
        "SELECT id, type, cron, payload, next_run_at FROM recurring_jobs \
         WHERE enabled AND cron IS NOT NULL AND (next_run_at IS NULL OR next_run_at <= now()) \
         ORDER BY id FOR NO KEY UPDATE SKIP LOCKED",
    )
    .fetch_all(&mut *tx)
    .await?;

    for row in due {
        dispatch_row(&mut tx, registry, row).await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Source commits mark this registration due and notify `jobs`. Run before
/// every claim so notifications, polling and job completion all drain demand.
pub async fn dispatch_movie_search(pool: &PgPool, registry: &Registry) -> sqlx::Result<()> {
    if registry.get(MOVIE_SEARCH_SYNC).is_none() {
        return Ok(());
    }
    let mut tx = pool.begin().await?;
    let row: Option<DueRecurring> = sqlx::query_as(
        "SELECT id, type, cron, payload, next_run_at FROM recurring_jobs \
         WHERE id=$1 AND type=$1 AND enabled AND cron IS NOT NULL \
           AND (next_run_at IS NULL OR next_run_at <= now()) \
         FOR NO KEY UPDATE SKIP LOCKED",
    )
    .bind(MOVIE_SEARCH_SYNC)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(row) = row {
        dispatch_row(&mut tx, registry, row).await?;
    }
    tx.commit().await?;
    Ok(())
}

async fn dispatch_row(
    tx: &mut Transaction<'_, Postgres>,
    registry: &Registry,
    row: DueRecurring,
) -> sqlx::Result<()> {
    let movie_demand = row.id == MOVIE_SEARCH_SYNC && row.job_type == MOVIE_SEARCH_SYNC;
    if movie_demand && registry.get(MOVIE_SEARCH_SYNC).is_none() {
        return Ok(());
    }
    match decide(row.cron.as_deref(), row.next_run_at, Utc::now()) {
        Decision::ManualOnly => {}
        Decision::InvalidCron(reason) => {
            tracing::warn!(application_event = "recurring_job_invalid_cron", recurring_job_id = %row.id, %reason, "skipping recurring job with invalid cron");
        }
        Decision::ScheduleOnly { next_run_at } => {
            sqlx::query(
                "UPDATE recurring_jobs SET next_run_at = $2, updated_at = now() WHERE id = $1",
            )
            .bind(&row.id)
            .bind(next_run_at)
            .execute(&mut **tx)
            .await?;
            tracing::info!(recurring_job_id = %row.id, %next_run_at, "scheduled recurring job");
        }
        Decision::Enqueue { next_run_at } => {
            let concurrency_key = registry
                .get(&row.job_type)
                .and_then(|h| h.concurrency_key(&row.payload));
            let job_id = queue::enqueue_in_tx(
                tx,
                &row.job_type,
                &row.payload,
                concurrency_key.as_deref(),
                Some(&row.id),
            )
            .await?;
            match job_id {
                Some(job_id) => {
                    sqlx::query(
                        "UPDATE recurring_jobs SET next_run_at = $2, last_enqueued_at = now(), \
                                 last_job_id = $3, updated_at = now() WHERE id = $1",
                    )
                    .bind(&row.id)
                    .bind(next_run_at)
                    .bind(job_id)
                    .execute(&mut **tx)
                    .await?;
                    tracing::info!(recurring_job_id = %row.id, %job_id, %next_run_at, "enqueued recurring job");
                }
                None => {
                    // Movie due times also carry source-change requests.
                    // Keep them pending while another search/retry/bounded
                    // continuation owns the key; never shorten its run_at.
                    if !movie_demand {
                        sqlx::query("UPDATE recurring_jobs SET next_run_at = $2, updated_at = now() WHERE id = $1")
                                .bind(&row.id)
                                .bind(next_run_at)
                                .execute(&mut **tx)
                                .await?;
                    }
                    tracing::info!(
                        recurring_job_id = %row.id,
                        "skipped recurring run: a job with the same concurrency key is active"
                    );
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(h: u32, m: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2026, 5, 10, h, m, 0).unwrap()
    }

    #[test]
    fn null_next_run_only_schedules() {
        assert_eq!(
            decide(Some("0 3 * * *"), None, at(1, 0)),
            Decision::ScheduleOnly {
                next_run_at: at(3, 0)
            }
        );
    }

    #[test]
    fn due_run_enqueues_and_advances_from_now() {
        let next_day = Utc.with_ymd_and_hms(2026, 5, 11, 3, 0, 0).unwrap();
        assert_eq!(
            decide(Some("0 3 * * *"), Some(at(3, 0)), at(3, 0)),
            Decision::Enqueue {
                next_run_at: next_day
            }
        );
        // Stale next_run_at from days ago still yields a single future run.
        let long_ago = Utc.with_ymd_and_hms(2026, 1, 1, 3, 0, 0).unwrap();
        assert_eq!(
            decide(Some("0 3 * * *"), Some(long_ago), at(4, 0)),
            Decision::Enqueue {
                next_run_at: next_day
            }
        );
    }

    #[test]
    fn null_cron_is_manual_only() {
        assert_eq!(decide(None, None, at(1, 0)), Decision::ManualOnly);
        assert_eq!(decide(None, Some(at(0, 0)), at(1, 0)), Decision::ManualOnly);
    }

    #[test]
    fn invalid_cron_is_skipped() {
        assert!(matches!(
            decide(Some("bogus"), None, at(1, 0)),
            Decision::InvalidCron(_)
        ));
    }
}
