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
