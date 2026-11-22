//! Daily movie scheduling and bounded continuation against disposable migrated PostgreSQL.
use std::time::Duration;

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;
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
        Some("search.movies.index".into())
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
async fn daily_movie_schedule_preserves_continuations_without_extra_runs() {
    let Ok(url) = std::env::var("WORKER_TEST_DATABASE_URL") else {
        eprintln!("WORKER_TEST_DATABASE_URL not set; skipping movie schedule integration");
        return;
    };
    let pool = PgPool::connect(&url).await.unwrap();
    let mut registry = Registry::new();
    registry.register(MovieSync);
    sqlx::query("UPDATE recurring_jobs SET enabled=true,cron='50 7 * * *',next_run_at=now()+interval '1 hour' WHERE id=$1")
        .bind(MOVIE_SYNC).execute(&pool).await.unwrap();
    scheduler::tick(&pool, &registry).await.unwrap();
    assert!(jobs(&pool).await.is_empty());

    sqlx::query("UPDATE recurring_jobs SET next_run_at=now()-interval '1 second' WHERE id=$1")
        .bind(MOVIE_SYNC)
        .execute(&pool)
        .await
        .unwrap();
    let requested = due(&pool).await;
    scheduler::tick(&pool, &Registry::new()).await.unwrap();
    assert_eq!(
        due(&pool).await,
        requested,
        "an incapable worker preserves the schedule"
    );
    for settings in ["enabled=false", "enabled=true,cron=NULL"] {
        sqlx::query(&format!("UPDATE recurring_jobs SET {settings} WHERE id=$1"))
            .bind(MOVIE_SYNC)
            .execute(&pool)
            .await
            .unwrap();
        scheduler::tick(&pool, &registry).await.unwrap();
        assert!(jobs(&pool).await.is_empty());
    }
    sqlx::query("UPDATE recurring_jobs SET enabled=true,cron='50 7 * * *' WHERE id=$1")
        .bind(MOVIE_SYNC)
        .execute(&pool)
        .await
        .unwrap();

    let blocker: Uuid = sqlx::query_scalar("INSERT INTO jobs (type,concurrency_key,run_at) VALUES ('test.movie-schedule-blocker','search.movies.index',now()+interval '2 minutes') RETURNING id")
        .fetch_one(&pool).await.unwrap();
    scheduler::tick(&pool, &registry).await.unwrap();
    assert_eq!(due(&pool).await, requested);
    assert!(jobs(&pool).await.is_empty());
    sqlx::query("DELETE FROM jobs WHERE id=$1")
        .bind(blocker)
        .execute(&pool)
        .await
        .unwrap();
    let (first, second) = tokio::join!(
        scheduler::tick(&pool, &registry),
        scheduler::tick(&pool, &registry)
    );
    first.unwrap();
    second.unwrap();
    let original = jobs(&pool).await[0];
    assert_eq!(jobs(&pool).await.len(), 1);
    let tomorrow = due(&pool).await;
    assert!(tomorrow > Utc::now());
    assert_eq!(tomorrow.format("%H:%M").to_string(), "07:50");

    // A job admitted by the preceding release still has the legacy key.
    sqlx::query("UPDATE jobs SET status='running',concurrency_key='search.index',locked_by='schedule-test',attempts=1,heartbeat_at=now() WHERE id=$1")
        .bind(original).execute(&pool).await.unwrap();
    let mut duplicate = pool.begin().await.unwrap();
    assert!(
        queue::enqueue_in_tx(
            &mut duplicate,
            MOVIE_SYNC,
            &serde_json::json!({}),
            Some("search.movies.index"),
            Some(MOVIE_SYNC)
        )
        .await
        .unwrap()
        .is_none()
    );
    duplicate.rollback().await.unwrap();
    // A bounded continuation can finalize while the scheduler owns its non-key lock.
    let mut schedule_lock = pool.begin().await.unwrap();
    sqlx::query("SELECT id FROM recurring_jobs WHERE id=$1 FOR NO KEY UPDATE")
        .bind(MOVIE_SYNC)
        .fetch_one(&mut *schedule_lock)
        .await
        .unwrap();
    let continuation_at = Utc::now() + chrono::Duration::seconds(45);
    assert!(
        tokio::time::timeout(
            Duration::from_secs(3),
            queue::mark_succeeded_with_continuation(
                &pool,
                original,
                "schedule-test",
                "bounded work",
                continuation_at,
            )
        )
        .await
        .expect("continuation FK does not wait on schedule lock")
        .unwrap()
    );
    schedule_lock.commit().await.unwrap();
    let continuation = jobs(&pool).await[1];
    let key: String = sqlx::query_scalar("SELECT concurrency_key FROM jobs WHERE id=$1")
        .bind(continuation)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(key, "search.movies.index");
    let mut independent = pool.begin().await.unwrap();
    assert!(
        queue::enqueue_in_tx(
            &mut independent,
            "test.independent-game-search",
            &serde_json::json!({}),
            Some("search.index"),
            None
        )
        .await
        .unwrap()
        .is_some()
    );
    independent.rollback().await.unwrap();
    scheduler::tick(&pool, &registry).await.unwrap();
    assert_eq!(due(&pool).await, tomorrow);
    let persisted: DateTime<Utc> = sqlx::query_scalar("SELECT run_at FROM jobs WHERE id=$1")
        .bind(continuation)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!((persisted - continuation_at).num_milliseconds().abs() < 2);
    sqlx::query("UPDATE jobs SET status='succeeded' WHERE id=$1")
        .bind(continuation)
        .execute(&pool)
        .await
        .unwrap();
    scheduler::tick(&pool, &registry).await.unwrap();
    assert_eq!(
        jobs(&pool).await.len(),
        2,
        "completion waits until the next daily schedule"
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
