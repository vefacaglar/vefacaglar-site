//! Real scheduler locking against disposable migrated PostgreSQL only.
use std::time::Duration;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::{PgPool, Row};
use uuid::Uuid;
use worker::context::JobContext;
use worker::handler::{JobHandler, JobOutcome, Registry};
use worker::{queue, scheduler};

const MOVIE_SYNC: &str = "search.movies.sync";

struct MovieSync;
#[async_trait]
impl JobHandler for MovieSync {
    fn job_type(&self) -> &'static str {
        MOVIE_SYNC
    }
    fn concurrency_key(&self, _: &Value) -> Option<String> {
        Some("search.index".into())
    }
    async fn run(&self, _: &JobContext) -> anyhow::Result<JobOutcome> {
        Ok(JobOutcome::Completed)
    }
}

async fn due(pool: &PgPool) -> DateTime<Utc> {
    sqlx::query_scalar("SELECT next_run_at FROM recurring_jobs WHERE id=$1")
        .bind(MOVIE_SYNC)
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn jobs(pool: &PgPool) -> Vec<Uuid> {
    sqlx::query_scalar("SELECT id FROM jobs WHERE recurring_job_id=$1 ORDER BY created_at,id")
        .bind(MOVIE_SYNC)
        .fetch_all(pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn durable_movie_demand_survives_conflicts_finalization_and_continuation() {
    let Ok(url) = std::env::var("WORKER_TEST_DATABASE_URL") else {
        eprintln!("WORKER_TEST_DATABASE_URL not set; skipping movie dispatcher integration");
        return;
    };
    let pool = PgPool::connect(&url).await.unwrap();
    let mut registry = Registry::new();
    registry.register(MovieSync);
    let unknown_registry = Registry::new();
    sqlx::query("UPDATE recurring_jobs SET enabled=true,cron='*/5 * * * *',next_run_at=now()+interval '1 hour' WHERE id=$1")
        .bind(MOVIE_SYNC).execute(&pool).await.unwrap();
    scheduler::dispatch_movie_search(&pool, &registry)
        .await
        .unwrap();
    assert!(jobs(&pool).await.is_empty());

    // A durable request survives startup without its capable handler and a
    // dropped notification: the next ordinary claim pass dispatches it.
    sqlx::query("UPDATE recurring_jobs SET next_run_at=now()-interval '1 second' WHERE id=$1")
        .bind(MOVIE_SYNC)
        .execute(&pool)
        .await
        .unwrap();
    let requested = due(&pool).await;
    scheduler::dispatch_movie_search(&pool, &unknown_registry)
        .await
        .unwrap();
    scheduler::tick(&pool, &unknown_registry).await.unwrap();
    assert_eq!(due(&pool).await, requested);
    assert!(jobs(&pool).await.is_empty());

    for settings in ["enabled=false", "enabled=true,cron=NULL"] {
        sqlx::query(&format!("UPDATE recurring_jobs SET {settings} WHERE id=$1"))
            .bind(MOVIE_SYNC)
            .execute(&pool)
            .await
            .unwrap();
        scheduler::dispatch_movie_search(&pool, &registry)
            .await
            .unwrap();
        scheduler::tick(&pool, &registry).await.unwrap();
        assert!(jobs(&pool).await.is_empty());
    }
    sqlx::query("UPDATE recurring_jobs SET enabled=true,cron='*/5 * * * *' WHERE id=$1")
        .bind(MOVIE_SYNC)
        .execute(&pool)
        .await
        .unwrap();

    // The API/manual enqueue path takes this same recurring lock before job
    // insertion and metadata updates. Dispatch must skip, rather than wait on
    // its uncommitted concurrency key and invert those locks.
    let mut manual = pool.begin().await.unwrap();
    sqlx::query("SELECT id FROM recurring_jobs WHERE id=$1 FOR NO KEY UPDATE")
        .bind(MOVIE_SYNC)
        .fetch_one(&mut *manual)
        .await
        .unwrap();
    let manual_job = queue::enqueue_in_tx(
        &mut manual,
        MOVIE_SYNC,
        &serde_json::json!({}),
        Some("search.index"),
        Some(MOVIE_SYNC),
    )
    .await
    .unwrap()
    .unwrap();
    tokio::time::timeout(
        Duration::from_secs(3),
        scheduler::dispatch_movie_search(&pool, &registry),
    )
    .await
    .expect("dispatch must skip an API enqueue's recurring lock")
    .unwrap();
    sqlx::query("UPDATE recurring_jobs SET last_job_id=$2,last_enqueued_at=now() WHERE id=$1")
        .bind(MOVIE_SYNC)
        .bind(manual_job)
        .execute(&mut *manual)
        .await
        .unwrap();
    manual.commit().await.unwrap();
    assert_eq!(due(&pool).await, requested);
    sqlx::query("DELETE FROM jobs WHERE id=$1")
        .bind(manual_job)
        .execute(&pool)
        .await
        .unwrap();

    // Another search type may own the shared key, including a queued retry.
    let blocker: Uuid = sqlx::query_scalar("INSERT INTO jobs (type,concurrency_key,run_at) VALUES ('test.movie-dispatch-blocker','search.index',now()+interval '2 minutes') RETURNING id")
        .fetch_one(&pool).await.unwrap();
    let retry_at: DateTime<Utc> = sqlx::query_scalar("SELECT run_at FROM jobs WHERE id=$1")
        .bind(blocker)
        .fetch_one(&pool)
        .await
        .unwrap();
    scheduler::dispatch_movie_search(&pool, &registry)
        .await
        .unwrap();
    scheduler::tick(&pool, &registry).await.unwrap();
    assert_eq!(due(&pool).await, requested);
    assert!(jobs(&pool).await.is_empty());
    let unchanged_retry: DateTime<Utc> = sqlx::query_scalar("SELECT run_at FROM jobs WHERE id=$1")
        .bind(blocker)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(retry_at, unchanged_retry);
    sqlx::query("DELETE FROM jobs WHERE id=$1")
        .bind(blocker)
        .execute(&pool)
        .await
        .unwrap();

    scheduler::dispatch_movie_search(&pool, &registry)
        .await
        .unwrap();
    let original = jobs(&pool).await[0];
    assert!(due(&pool).await > Utc::now());
    scheduler::dispatch_movie_search(&pool, &registry)
        .await
        .unwrap();
    assert_eq!(jobs(&pool).await, vec![original]);

    // Simulate a source commit after the handler's last empty read but before
    // its terminal UPDATE. An active job cannot consume this later request.
    sqlx::query("UPDATE jobs SET status='running',locked_by='dispatch-test',attempts=1,heartbeat_at=now() WHERE id=$1")
        .bind(original).execute(&pool).await.unwrap();
    sqlx::query("UPDATE recurring_jobs SET next_run_at=now()-interval '1 second' WHERE id=$1")
        .bind(MOVIE_SYNC)
        .execute(&pool)
        .await
        .unwrap();
    let later_request = due(&pool).await;
    scheduler::dispatch_movie_search(&pool, &registry)
        .await
        .unwrap();
    assert_eq!(due(&pool).await, later_request);

    // Continuation insertion checks the recurring FK while it holds a job
    // lock. NO KEY UPDATE permits its KEY SHARE check and avoids inversion.
    let mut dispatcher_lock = pool.begin().await.unwrap();
    sqlx::query("SELECT id FROM recurring_jobs WHERE id=$1 FOR NO KEY UPDATE")
        .bind(MOVIE_SYNC)
        .fetch_one(&mut *dispatcher_lock)
        .await
        .unwrap();
    let continuation_at = Utc::now() + chrono::Duration::seconds(45);
    let finalized = tokio::time::timeout(
        Duration::from_secs(3),
        queue::mark_succeeded_with_continuation(
            &pool,
            original,
            "dispatch-test",
            "bounded work",
            continuation_at,
        ),
    )
    .await
    .expect("continuation FK must not wait for recurring non-key lock")
    .unwrap();
    assert!(finalized);
    dispatcher_lock.commit().await.unwrap();
    let continuation = jobs(&pool).await[1];
    scheduler::dispatch_movie_search(&pool, &registry)
        .await
        .unwrap();
    scheduler::tick(&pool, &registry).await.unwrap();
    assert_eq!(due(&pool).await, later_request);
    let continuation_row = sqlx::query("SELECT run_at FROM jobs WHERE id=$1")
        .bind(continuation)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(
        (continuation_row.get::<DateTime<Utc>, _>("run_at") - continuation_at)
            .num_milliseconds()
            .abs()
            < 2
    );

    sqlx::query("UPDATE jobs SET status='succeeded' WHERE id=$1")
        .bind(continuation)
        .execute(&pool)
        .await
        .unwrap();
    // Concurrent dispatchers collapse to exactly one successor.
    let (first, second) = tokio::join!(
        scheduler::dispatch_movie_search(&pool, &registry),
        scheduler::dispatch_movie_search(&pool, &registry)
    );
    first.unwrap();
    second.unwrap();
    assert_eq!(jobs(&pool).await.len(), 3);
    assert!(due(&pool).await > Utc::now());
    sqlx::query("UPDATE jobs SET status='succeeded' WHERE recurring_job_id=$1")
        .bind(MOVIE_SYNC)
        .execute(&pool)
        .await
        .unwrap();
    scheduler::dispatch_movie_search(&pool, &registry)
        .await
        .unwrap();
    assert_eq!(
        jobs(&pool).await.len(),
        3,
        "empty completion must not chain"
    );

    sqlx::query("DELETE FROM jobs WHERE recurring_job_id=$1")
        .bind(MOVIE_SYNC)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "UPDATE recurring_jobs SET enabled=false,next_run_at=NULL,last_job_id=NULL WHERE id=$1",
    )
    .bind(MOVIE_SYNC)
    .execute(&pool)
    .await
    .unwrap();
    pool.close().await;
}
