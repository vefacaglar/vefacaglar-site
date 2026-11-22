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

/// What the scheduler does when `enqueue_in_tx` conflicts on `concurrency_key`
/// for a due recurring job (pure, for testing).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictAction {
    /// The same recurring job (by `recurring_job_id` or `type`) is already
    /// queued or running: advance `next_run_at` so a long-running job does not
    /// stack back-to-back duplicate runs.
    SkipSameActive,
    /// A different job temporarily holds the shared `concurrency_key` (or the
    /// blocker finished between conflict and lookup): leave `next_run_at`
    /// unchanged so the next scheduler tick retries once the key is free.
    DeferOtherActive,
}

pub fn classify_conflict(
    recurring_job_id: &str,
    job_type: &str,
    active_holder: Option<&queue::ActiveConcurrencyHolder>,
) -> ConflictAction {
    match active_holder {
        Some(holder)
            if holder.recurring_job_id.as_deref() == Some(recurring_job_id)
                || holder.job_type == job_type =>
        {
            ConflictAction::SkipSameActive
        }
        _ => ConflictAction::DeferOtherActive,
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

async fn dispatch_row(
    tx: &mut Transaction<'_, Postgres>,
    registry: &Registry,
    row: DueRecurring,
) -> sqlx::Result<()> {
    if registry.get(&row.job_type).is_none() {
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
                    let active_holder = if let Some(key) = concurrency_key.as_deref() {
                        queue::active_concurrency_holder_in_tx(tx, key).await?
                    } else {
                        None
                    };
                    match classify_conflict(&row.id, &row.job_type, active_holder.as_ref()) {
                        ConflictAction::SkipSameActive => {
                            sqlx::query(
                                "UPDATE recurring_jobs SET next_run_at = $2, updated_at = now() WHERE id = $1",
                            )
                            .bind(&row.id)
                            .bind(next_run_at)
                            .execute(&mut **tx)
                            .await?;
                            tracing::info!(
                                recurring_job_id = %row.id,
                                %next_run_at,
                                "skipped recurring run: same job is already active"
                            );
                        }
                        ConflictAction::DeferOtherActive => {
                            tracing::info!(
                                recurring_job_id = %row.id,
                                concurrency_key = concurrency_key.as_deref().unwrap_or(""),
                                active_job_type = active_holder
                                    .as_ref()
                                    .map(|h| h.job_type.as_str())
                                    .unwrap_or(""),
                                "deferred recurring run: another job holds the concurrency key"
                            );
                        }
                    }
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

    fn holder(job_type: &str, recurring_job_id: Option<&str>) -> queue::ActiveConcurrencyHolder {
        queue::ActiveConcurrencyHolder {
            job_type: job_type.to_string(),
            recurring_job_id: recurring_job_id.map(str::to_string),
        }
    }

    #[test]
    fn same_recurring_job_active_skips() {
        let same_recurring = holder(
            "catalog.popularity.refresh",
            Some("catalog.popularity.refresh"),
        );
        assert_eq!(
            classify_conflict(
                "catalog.popularity.refresh",
                "catalog.popularity.refresh",
                Some(&same_recurring),
            ),
            ConflictAction::SkipSameActive
        );
        // Matching recurring_job_id still counts as the same recurring job.
        let matching_id = holder("other.type", Some("custom.recurring"));
        assert_eq!(
            classify_conflict(
                "custom.recurring",
                "catalog.popularity.refresh",
                Some(&matching_id)
            ),
            ConflictAction::SkipSameActive
        );
    }

    #[test]
    fn same_job_type_without_recurring_id_skips() {
        let manual_same = holder("catalog.popularity.refresh", None);
        assert_eq!(
            classify_conflict(
                "catalog.popularity.refresh",
                "catalog.popularity.refresh",
                Some(&manual_same),
            ),
            ConflictAction::SkipSameActive
        );
    }

    #[test]
    fn different_job_holding_shared_key_defers() {
        let movie_sync = holder("search.movies.sync", Some("search.movies.sync"));
        assert_eq!(
            classify_conflict(
                "catalog.popularity.refresh",
                "catalog.popularity.refresh",
                Some(&movie_sync),
            ),
            ConflictAction::DeferOtherActive
        );
        let manual_reindex = holder("search.reindex", None);
        assert_eq!(
            classify_conflict(
                "catalog.popularity.refresh",
                "catalog.popularity.refresh",
                Some(&manual_reindex),
            ),
            ConflictAction::DeferOtherActive
        );
    }

    #[test]
    fn vanished_holder_defers() {
        assert_eq!(
            classify_conflict(
                "catalog.popularity.refresh",
                "catalog.popularity.refresh",
                None,
            ),
            ConflictAction::DeferOtherActive
        );
    }
}
