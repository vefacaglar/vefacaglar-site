//! Queue SQL against a real Postgres with the Drizzle migrations applied.
//! Skipped unless `WORKER_TEST_DATABASE_URL` is set. NEVER point it at
//! production: the test inserts and deletes rows in `jobs`.

use std::time::Duration;

use serde_json::json;
use sqlx::PgPool;
use sqlx::postgres::PgListener;
use uuid::Uuid;
use worker::context::Progress;
use worker::queue::{self, FailureResult, Held};

async fn pool() -> Option<PgPool> {
    let url = std::env::var("WORKER_TEST_DATABASE_URL").ok()?;
    Some(
        PgPool::connect(&url)
            .await
            .expect("connect WORKER_TEST_DATABASE_URL"),
    )
}

#[tokio::test]
async fn claim_checkpoint_fail_reap_cycle() {
    let Some(pool) = pool().await else {
        eprintln!("WORKER_TEST_DATABASE_URL not set; skipping");
        return;
    };
    let job_type = format!("test.{}", Uuid::new_v4());
    let worker_id = format!("test-worker-{}", Uuid::new_v4());
    let types = vec![job_type.clone()];
    let job_id: Uuid =
        sqlx::query_scalar("INSERT INTO jobs (type, payload) VALUES ($1, '{}') RETURNING id")
            .bind(&job_type)
            .fetch_one(&pool)
            .await
            .unwrap();

    let mut listener = PgListener::connect_with(&pool).await.unwrap();
    listener.listen("job_events").await.unwrap();

    let claimed = queue::claim(&pool, &worker_id, &types)
        .await
        .unwrap()
        .expect("claimed");
    assert_eq!(claimed.id, job_id);
    assert_eq!(claimed.attempts, 1);
    let event = tokio::time::timeout(Duration::from_secs(5), listener.recv())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(event.payload(), job_id.to_string());
    assert!(
        queue::claim(&pool, &worker_id, &types)
            .await
            .unwrap()
            .is_none()
    );

    let progress = Progress {
        phase: Some("indexing:test".into()),
        processed: Some(1),
        total: Some(2),
        message: None,
    };
    let held = queue::save_checkpoint(&pool, job_id, &worker_id, &progress, &json!({"n": 1}))
        .await
        .unwrap();
    assert_eq!(
        held,
        Held::Yes {
            cancel_requested: false
        }
    );
    assert_eq!(
        queue::save_progress(&pool, job_id, "someone-else", &progress)
            .await
            .unwrap(),
        Held::Lost
    );

    let result = queue::mark_failed(
        &pool,
        job_id,
        &worker_id,
        "boom",
        Duration::from_secs(30),
        false,
    )
    .await
    .unwrap();
    assert_eq!(result, FailureResult::Retrying);
    let (status, checkpoint): (String, Option<serde_json::Value>) =
        sqlx::query_as("SELECT status, checkpoint FROM jobs WHERE id = $1")
            .bind(job_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status, "queued");
    assert_eq!(checkpoint, Some(json!({"n": 1})));

    // Simulate a lost worker and reap it.
    sqlx::query("UPDATE jobs SET status = 'running', locked_by = 'ghost', heartbeat_at = now() - interval '5 minutes' WHERE id = $1")
        .bind(job_id)
        .execute(&pool)
        .await
        .unwrap();
    let reaped = queue::reap_stale(&pool).await.unwrap();
    assert!(reaped.contains(&job_id));

    sqlx::query("DELETE FROM jobs WHERE id = $1")
        .bind(job_id)
        .execute(&pool)
        .await
        .unwrap();
}

#[tokio::test]
async fn movie_continuation_is_atomic_unique_and_obeys_late_cancellation() {
    let Some(pool) = pool().await else {
        eprintln!("WORKER_TEST_DATABASE_URL not set; skipping movie continuation integration");
        return;
    };
    let registered_id = format!("test.movies.{}", Uuid::new_v4());
    let worker_id = format!("test-movies-worker-{}", Uuid::new_v4());
    sqlx::query(
        "INSERT INTO recurring_jobs (id, type, cron) VALUES ($1, 'catalog.movies.sync', NULL)",
    )
    .bind(&registered_id)
    .execute(&pool)
    .await
    .unwrap();
    let payload = json!({"fixture": "preserve original payload"});
    let original: Uuid = sqlx::query_scalar("INSERT INTO jobs (type,status,payload,concurrency_key,recurring_job_id,max_attempts,locked_by) VALUES ('catalog.movies.sync','running',$1,'catalog.movies',$2,5,$3) RETURNING id")
        .bind(&payload).bind(&registered_id).bind(&worker_id).fetch_one(&pool).await.unwrap();
    let at = chrono::Utc::now() + chrono::Duration::minutes(2);
    assert!(
        !queue::mark_succeeded_with_continuation(&pool, original, "wrong-owner", "batch", at)
            .await
            .unwrap()
    );
    assert!(
        queue::mark_succeeded_with_continuation(&pool, original, &worker_id, "batch", at)
            .await
            .unwrap()
    );
    // A duplicate finalization after commit cannot create a second successor.
    assert!(
        !queue::mark_succeeded_with_continuation(&pool, original, &worker_id, "duplicate", at)
            .await
            .unwrap()
    );
    let (status,): (String,) = sqlx::query_as("SELECT status FROM jobs WHERE id = $1")
        .bind(original)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status, "succeeded");
    type Successor = (
        Uuid,
        String,
        serde_json::Value,
        Option<String>,
        i32,
        chrono::DateTime<chrono::Utc>,
    );
    let successors: Vec<Successor> = sqlx::query_as("SELECT id,type,payload,concurrency_key,max_attempts,run_at FROM jobs WHERE recurring_job_id = $1 AND id <> $2")
        .bind(&registered_id).bind(original).fetch_all(&pool).await.unwrap();
    assert_eq!(successors.len(), 1);
    let (successor, kind, next_payload, key, max_attempts, run_at) = &successors[0];
    assert_eq!(kind, "catalog.movies.sync");
    assert_eq!(next_payload, &payload);
    assert_eq!(key.as_deref(), Some("catalog.movies"));
    assert_eq!(*max_attempts, 5);
    assert!((*run_at - at).num_milliseconds().abs() < 2);
    // Force a rollback after the terminal UPDATE by violating a successor check.
    // This uses a temporary test-only constraint, never a production migration.
    sqlx::query("UPDATE jobs SET status='running',locked_by=$2 WHERE id=$1")
        .bind(successor)
        .bind(&worker_id)
        .execute(&pool)
        .await
        .unwrap();
    let constraint = format!("test_no_successor_{}", Uuid::new_v4().simple());
    sqlx::query(&format!("ALTER TABLE jobs ADD CONSTRAINT {constraint} CHECK (status <> 'queued' OR recurring_job_id IS DISTINCT FROM '{registered_id}') NOT VALID"))
        .execute(&pool).await.unwrap();
    assert!(
        queue::mark_succeeded_with_continuation(&pool, *successor, &worker_id, "must rollback", at)
            .await
            .is_err()
    );
    sqlx::query(&format!("ALTER TABLE jobs DROP CONSTRAINT {constraint}"))
        .execute(&pool)
        .await
        .unwrap();
    let (still_running,): (String,) = sqlx::query_as("SELECT status FROM jobs WHERE id=$1")
        .bind(successor)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(still_running, "running");
    // A cancel arriving after the CLI exit is read in the terminal UPDATE.
    sqlx::query("UPDATE jobs SET cancel_requested=true WHERE id=$1")
        .bind(successor)
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        queue::mark_succeeded_with_continuation(&pool, *successor, &worker_id, "late cancel", at)
            .await
            .unwrap()
    );
    let (cancelled,): (String,) = sqlx::query_as("SELECT status FROM jobs WHERE id=$1")
        .bind(successor)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(cancelled, "cancelled");
    let (count,): (i64,) = sqlx::query_as("SELECT count(*) FROM jobs WHERE recurring_job_id=$1")
        .bind(&registered_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 2);
    sqlx::query("DELETE FROM jobs WHERE recurring_job_id=$1")
        .bind(&registered_id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM recurring_jobs WHERE id=$1")
        .bind(&registered_id)
        .execute(&pool)
        .await
        .unwrap();
}
