//! Queue SQL against a real Postgres with the Drizzle migrations applied.
//! Skipped unless `WORKER_TEST_DATABASE_URL` is set. NEVER point it at
//! production: the test inserts and deletes rows in `jobs`.

use std::time::Duration;

use serde_json::json;
use sqlx::postgres::PgListener;
use sqlx::{PgPool, postgres::PgPoolOptions};
use uuid::Uuid;
use worker::context::Progress;
use worker::queue::{self, FailureResult, Held};

// Queue admission and stale recovery are global, so fixtures sharing this
// disposable database must not manufacture competing running rows in parallel.
static QUEUE_FIXTURE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

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
    let _fixture = QUEUE_FIXTURE.lock().await;
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
    let _fixture = QUEUE_FIXTURE.lock().await;
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
    let original: Uuid = sqlx::query_scalar("INSERT INTO jobs (type,status,payload,concurrency_key,recurring_job_id,max_attempts,locked_by,heartbeat_at,locked_at,started_at,attempts) VALUES ('catalog.movies.sync','running',$1,'catalog.movies',$2,5,$3,now(),now(),now(),1) RETURNING id")
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
    // Emulate a real claim: a null heartbeat correctly makes the parallel
    // stale-worker integration test reap this otherwise healthy fixture.
    sqlx::query("UPDATE jobs SET status='running',locked_by=$2,heartbeat_at=now(),locked_at=now(),started_at=now(),attempts=1 WHERE id=$1")
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

#[tokio::test]
async fn global_capacity_serializes_claimers_and_releases_only_finished_leases() {
    let _fixture = QUEUE_FIXTURE.lock().await;
    let Ok(url) = std::env::var("WORKER_TEST_DATABASE_URL") else {
        eprintln!("WORKER_TEST_DATABASE_URL not set; skipping capacity integration");
        return;
    };
    // The claim must override a session default that would otherwise keep the
    // snapshot taken before waiting for another claimant's transaction lock.
    let pool = PgPoolOptions::new()
        .max_connections(6)
        .after_connect(|connection, _| {
            Box::pin(async move {
                sqlx::query("SET default_transaction_isolation = 'repeatable read'")
                    .execute(connection)
                    .await?;
                Ok(())
            })
        })
        .connect(&url)
        .await
        .unwrap();
    let kind = format!("test.capacity.{}", Uuid::new_v4());
    let types: Vec<String> = (1..=4).map(|n| format!("{kind}.{n}")).collect();
    let ids: Vec<Uuid> = sqlx::query_scalar(
        "INSERT INTO jobs(type,concurrency_key) SELECT kind,kind FROM unnest($1::text[]) kind RETURNING id",
    )
    .bind(&types)
    .fetch_all(&pool)
    .await
    .unwrap();
    let (a, b, c) = tokio::join!(
        queue::claim(&pool, "capacity-a", &types),
        queue::claim(&pool, "capacity-b", &types),
        queue::claim(&pool, "capacity-c", &types),
    );
    let admitted = [a.unwrap(), b.unwrap(), c.unwrap()];
    assert_eq!(admitted.iter().flatten().count(), 2);
    let running: Vec<(Uuid, String)> = sqlx::query_as(
        "SELECT id,locked_by FROM jobs WHERE type=ANY($1) AND status='running' ORDER BY id",
    )
    .bind(&types)
    .fetch_all(&pool)
    .await
    .unwrap();
    assert_eq!(running.len() as i64, queue::MAX_RUNNING_JOBS);
    let queued_type: String =
        sqlx::query_scalar("SELECT type FROM jobs WHERE type=ANY($1) AND status='queued' LIMIT 1")
            .bind(&types)
            .fetch_one(&pool)
            .await
            .unwrap();
    // Capacity includes running types this particular worker cannot handle.
    assert!(
        queue::claim(&pool, "capacity-other-type", &[queued_type])
            .await
            .unwrap()
            .is_none()
    );
    sqlx::query("UPDATE jobs SET cancel_requested=true WHERE id=$1")
        .bind(running[0].0)
        .execute(&pool)
        .await
        .unwrap();
    assert!(
        queue::claim(&pool, "capacity-wait", &types)
            .await
            .unwrap()
            .is_none()
    );
    assert!(
        queue::mark_cancelled(&pool, running[0].0, &running[0].1, "cancelled")
            .await
            .unwrap()
    );
    let replacement = queue::claim(&pool, "capacity-after-cancel", &types)
        .await
        .unwrap()
        .unwrap();
    assert!(ids.contains(&replacement.id));
    assert!(
        queue::claim(&pool, "capacity-still-full", &types)
            .await
            .unwrap()
            .is_none()
    );

    assert!(
        queue::mark_succeeded(&pool, running[1].0, &running[1].1, "done")
            .await
            .unwrap()
    );
    let fourth = queue::claim(&pool, "capacity-fourth", &types)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        queue::mark_failed(
            &pool,
            replacement.id,
            "capacity-after-cancel",
            "permanent",
            Duration::ZERO,
            true
        )
        .await
        .unwrap(),
        FailureResult::Failed
    );
    let running_after_failure: i64 =
        sqlx::query_scalar("SELECT count(*) FROM jobs WHERE status='running'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(running_after_failure, 1);
    // A queued retry keeps its delay but no longer consumes a running slot.
    assert_eq!(
        queue::mark_failed(
            &pool,
            fourth.id,
            "capacity-fourth",
            "retry",
            Duration::from_secs(60),
            false
        )
        .await
        .unwrap(),
        FailureResult::Retrying
    );
    assert!(
        queue::claim(&pool, "capacity-backoff", &types)
            .await
            .unwrap()
            .is_none()
    );
    sqlx::query("UPDATE jobs SET run_at=now()-interval '1 second' WHERE id=$1")
        .bind(fourth.id)
        .execute(&pool)
        .await
        .unwrap();
    let resumed = queue::claim(&pool, "capacity-resumed", &types)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(resumed.id, fourth.id);
    sqlx::query("UPDATE jobs SET heartbeat_at=now()-interval '2 minutes' WHERE id=$1")
        .bind(fourth.id)
        .execute(&pool)
        .await
        .unwrap();
    assert!(queue::reap_stale(&pool).await.unwrap().contains(&fourth.id));
    let recovered = queue::claim(&pool, "capacity-recovered", &types)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(recovered.id, fourth.id);
    assert!(
        queue::requeue_for_shutdown(
            &pool,
            recovered.id,
            "capacity-recovered",
            queue::LogLevel::Info,
            "paused"
        )
        .await
        .unwrap()
    );
    assert!(
        queue::claim(&pool, "capacity-restarted", &types)
            .await
            .unwrap()
            .is_some()
    );
    sqlx::query("DELETE FROM jobs WHERE type=ANY($1)")
        .bind(&types)
        .execute(&pool)
        .await
        .unwrap();
    pool.close().await;
}

#[tokio::test]
async fn active_keys_stay_unique_and_pruning_preserves_live_workers_and_history() {
    let _fixture = QUEUE_FIXTURE.lock().await;
    let Some(pool) = pool().await else {
        eprintln!("WORKER_TEST_DATABASE_URL not set; skipping worker pruning integration");
        return;
    };
    let prefix = format!("test.prune.{}", Uuid::new_v4());
    let stale = format!("{prefix}.stale");
    let recent = format!("{prefix}.recent");
    let active = format!("{prefix}.active");
    for (id, age) in [(&stale, 7200.0), (&recent, 1800.0), (&active, 7200.0)] {
        sqlx::query("INSERT INTO workers(id,hostname,version,started_at,last_seen_at) VALUES($1,'fixture','test',now()-interval '1 day',now()-make_interval(secs=>$2))")
            .bind(id).bind(age).execute(&pool).await.unwrap();
    }
    let mut tx = pool.begin().await.unwrap();
    let one = queue::enqueue_in_tx(&mut tx, &prefix, &json!({}), Some(&prefix), None)
        .await
        .unwrap()
        .unwrap();
    assert!(
        queue::enqueue_in_tx(&mut tx, &prefix, &json!({}), Some(&prefix), None)
            .await
            .unwrap()
            .is_none()
    );
    tx.commit().await.unwrap();
    let claimed = queue::claim(&pool, &active, std::slice::from_ref(&prefix))
        .await
        .unwrap()
        .unwrap();
    assert_eq!(claimed.id, one);
    assert_eq!(queue::prune_workers(&pool).await.unwrap(), 1);
    let remaining: Vec<String> =
        sqlx::query_scalar("SELECT id FROM workers WHERE id LIKE $1 ORDER BY id")
            .bind(format!("{prefix}%"))
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(remaining, vec![active.clone(), recent.clone()]);
    assert!(
        queue::mark_succeeded(&pool, one, &active, "done")
            .await
            .unwrap()
    );
    assert_eq!(queue::prune_workers(&pool).await.unwrap(), 1);
    let history: (String, String, i64) = sqlx::query_as("SELECT status,locked_by,(SELECT count(*) FROM job_logs WHERE job_id=$1) FROM jobs WHERE id=$1")
        .bind(one).fetch_one(&pool).await.unwrap();
    assert_eq!(history.0, "succeeded");
    assert_eq!(history.1, active);
    assert!(history.2 >= 2);
    sqlx::query("DELETE FROM jobs WHERE id=$1")
        .bind(one)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM workers WHERE id LIKE $1")
        .bind(format!("{prefix}%"))
        .execute(&pool)
        .await
        .unwrap();
}
