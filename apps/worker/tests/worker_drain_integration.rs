//! Actual worker admission and natural job completion in disposable PostgreSQL.
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::Duration;

use async_trait::async_trait;
use sqlx::{PgPool, postgres::PgPoolOptions};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;
use worker::config::Config;
use worker::context::JobContext;
use worker::control::{self, Mode};
use worker::handler::{JobHandler, JobOutcome, Registry};
use worker::runner::Worker;

static DRAIN_FIXTURE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

struct Hold {
    kind: &'static str,
    release: CancellationToken,
    started: Arc<AtomicUsize>,
    interrupted: Arc<AtomicBool>,
}

#[async_trait]
impl JobHandler for Hold {
    fn job_type(&self) -> &'static str {
        self.kind
    }

    async fn run(&self, context: &JobContext) -> anyhow::Result<JobOutcome> {
        self.started.fetch_add(1, Ordering::SeqCst);
        self.release.cancelled().await;
        if context.should_stop() {
            self.interrupted.store(true, Ordering::SeqCst);
        }
        Ok(JobOutcome::Completed)
    }
}

fn config(directory: &Path, id: &str) -> Config {
    Config {
        database_url: String::new(),
        db_pool_max: 10,
        worker_id: id.into(),
        hostname: "drain-fixture".into(),
        health_file: directory.join(format!("{id}.health")),
        control_file: Some(directory.join(format!("{id}.mode"))),
        control_status_file: directory.join(format!("{id}.state")),
        typesense: None,
    }
}

async fn wait_mode(config: &Config, mode: Mode) {
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            if control::read_status(&config.control_status_file) == Ok(mode) {
                break;
            }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .expect("worker must acknowledge admission control");
}

async fn wait_count(counter: &AtomicUsize, count: usize) {
    tokio::time::timeout(Duration::from_secs(8), async {
        while counter.load(Ordering::SeqCst) < count {
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .expect("expected job must start");
}

fn registry(
    kind: &'static str,
    release: &CancellationToken,
    started: &Arc<AtomicUsize>,
    interrupted: &Arc<AtomicBool>,
) -> Registry {
    let mut registry = Registry::new();
    registry.register(Hold {
        kind,
        release: release.clone(),
        started: started.clone(),
        interrupted: interrupted.clone(),
    });
    registry
}

#[tokio::test]
async fn standby_then_drain_keeps_the_old_job_alive_and_respects_global_capacity() {
    let _fixture = DRAIN_FIXTURE.lock().await;
    let Ok(url) = std::env::var("WORKER_TEST_DATABASE_URL") else {
        eprintln!("WORKER_TEST_DATABASE_URL not set; skipping drain integration");
        return;
    };
    let pool: PgPool = PgPoolOptions::new()
        .max_connections(12)
        .connect(&url)
        .await
        .unwrap();
    let prefix = format!("test.drain.{}", Uuid::new_v4().simple());
    let old_kind: &'static str = Box::leak(format!("{prefix}.old").into_boxed_str());
    let new_kind: &'static str = Box::leak(format!("{prefix}.new").into_boxed_str());
    let directory = std::env::temp_dir().join(&prefix);
    std::fs::create_dir_all(&directory).unwrap();
    let old = config(&directory, &format!("{prefix}-old"));
    let a = config(&directory, &format!("{prefix}-a"));
    let b = config(&directory, &format!("{prefix}-b"));
    std::fs::write(old.control_file.as_ref().unwrap(), "active").unwrap();
    for candidate in [&a, &b] {
        std::fs::write(candidate.control_file.as_ref().unwrap(), "standby").unwrap();
    }
    let old_job: Uuid = sqlx::query_scalar("INSERT INTO jobs(type) VALUES($1) RETURNING id")
        .bind(old_kind)
        .fetch_one(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO jobs(type) SELECT $1 FROM generate_series(1,2)")
        .bind(new_kind)
        .execute(&pool)
        .await
        .unwrap();
    let old_release = CancellationToken::new();
    let new_release = CancellationToken::new();
    let old_started = Arc::new(AtomicUsize::new(0));
    let new_started = Arc::new(AtomicUsize::new(0));
    let interrupted = Arc::new(AtomicBool::new(false));
    let old_shutdown = CancellationToken::new();
    let old_task = tokio::spawn(
        Worker::new(
            pool.clone(),
            old.clone(),
            registry(old_kind, &old_release, &old_started, &interrupted),
            old_shutdown.clone(),
        )
        .run(),
    );
    wait_count(&old_started, 1).await;
    let a_task = tokio::spawn(
        Worker::new(
            pool.clone(),
            a.clone(),
            registry(new_kind, &new_release, &new_started, &interrupted),
            CancellationToken::new(),
        )
        .run(),
    );
    let b_task = tokio::spawn(
        Worker::new(
            pool.clone(),
            b.clone(),
            registry(new_kind, &new_release, &new_started, &interrupted),
            CancellationToken::new(),
        )
        .run(),
    );
    wait_mode(&a, Mode::Standby).await;
    wait_mode(&b, Mode::Standby).await;
    tokio::time::sleep(Duration::from_millis(350)).await;
    assert_eq!(new_started.load(Ordering::SeqCst), 0);

    let before: chrono::DateTime<chrono::Utc> =
        sqlx::query_scalar("SELECT heartbeat_at FROM jobs WHERE id=$1")
            .bind(old_job)
            .fetch_one(&pool)
            .await
            .unwrap();
    std::fs::write(old.control_file.as_ref().unwrap(), "drain").unwrap();
    wait_mode(&old, Mode::Drain).await;
    for candidate in [&a, &b] {
        std::fs::write(candidate.control_file.as_ref().unwrap(), "active").unwrap();
        wait_mode(candidate, Mode::Active).await;
    }
    wait_count(&new_started, 1).await;
    tokio::time::sleep(Duration::from_millis(350)).await;
    assert_eq!(new_started.load(Ordering::SeqCst), 1);
    let running: i64 = sqlx::query_scalar("SELECT count(*) FROM jobs WHERE status='running'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(running, 2);
    // Draining does not stop heartbeat or install a shutdown deadline.
    tokio::time::sleep(Duration::from_secs(11)).await;
    let after: chrono::DateTime<chrono::Utc> =
        sqlx::query_scalar("SELECT heartbeat_at FROM jobs WHERE id=$1")
            .bind(old_job)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(after > before);
    assert!(!old_task.is_finished());
    assert!(!old_shutdown.is_cancelled());
    old_release.cancel();
    tokio::time::timeout(Duration::from_secs(5), old_task)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    let outcome: (String, i32) = sqlx::query_as("SELECT status,attempts FROM jobs WHERE id=$1")
        .bind(old_job)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(outcome, ("succeeded".into(), 1));
    assert!(!interrupted.load(Ordering::SeqCst));
    wait_count(&new_started, 2).await;
    new_release.cancel();
    for candidate in [&a, &b] {
        std::fs::write(candidate.control_file.as_ref().unwrap(), "drain").unwrap();
    }
    for task in [a_task, b_task] {
        tokio::time::timeout(Duration::from_secs(5), task)
            .await
            .unwrap()
            .unwrap()
            .unwrap();
    }
    assert!(!interrupted.load(Ordering::SeqCst));
    let running: i64 = sqlx::query_scalar("SELECT count(*) FROM jobs WHERE status='running'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(running, 0);
    // A restarted retired generation reads durable drain and cannot claim.
    let restarts = Arc::new(AtomicUsize::new(0));
    let restart_release = CancellationToken::new();
    sqlx::query("INSERT INTO jobs(type) VALUES($1)")
        .bind(old_kind)
        .execute(&pool)
        .await
        .unwrap();
    Worker::new(
        pool.clone(),
        old.clone(),
        registry(old_kind, &restart_release, &restarts, &interrupted),
        CancellationToken::new(),
    )
    .run()
    .await
    .unwrap();
    assert_eq!(restarts.load(Ordering::SeqCst), 0);
    sqlx::query("DELETE FROM jobs WHERE type=ANY($1)")
        .bind(vec![old_kind, new_kind])
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM workers WHERE id=ANY($1)")
        .bind(vec![&old.worker_id, &a.worker_id, &b.worker_id])
        .execute(&pool)
        .await
        .unwrap();
    pool.close().await;
    std::fs::remove_dir_all(directory).unwrap();
}

#[tokio::test]
async fn drain_acknowledgement_waits_for_an_inflight_claim_and_never_claims_again() {
    let _fixture = DRAIN_FIXTURE.lock().await;
    let Ok(url) = std::env::var("WORKER_TEST_DATABASE_URL") else {
        eprintln!("WORKER_TEST_DATABASE_URL not set; skipping claim-fence integration");
        return;
    };
    let pool = PgPoolOptions::new()
        .max_connections(12)
        .connect(&url)
        .await
        .unwrap();
    let prefix = format!("test.claim-fence.{}", Uuid::new_v4().simple());
    let kind: &'static str = Box::leak(prefix.clone().into_boxed_str());
    let directory = std::env::temp_dir().join(&prefix);
    std::fs::create_dir_all(&directory).unwrap();
    let config = config(&directory, &prefix);
    std::fs::write(config.control_file.as_ref().unwrap(), "active").unwrap();
    sqlx::query("INSERT INTO jobs(type) SELECT $1 FROM generate_series(1,2)")
        .bind(kind)
        .execute(&pool)
        .await
        .unwrap();
    let mut fence = pool.begin().await.unwrap();
    sqlx::query("LOCK TABLE jobs IN SHARE MODE")
        .execute(&mut *fence)
        .await
        .unwrap();
    let release = CancellationToken::new();
    let started = Arc::new(AtomicUsize::new(0));
    let interrupted = Arc::new(AtomicBool::new(false));
    let task = tokio::spawn(
        Worker::new(
            pool.clone(),
            config.clone(),
            registry(kind, &release, &started, &interrupted),
            CancellationToken::new(),
        )
        .run(),
    );
    tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            let claiming: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM pg_locks admission JOIN pg_locks waiting ON waiting.pid=admission.pid WHERE admission.locktype='advisory' AND admission.granted AND waiting.locktype='relation' AND NOT waiting.granted)",
            ).fetch_one(&pool).await.unwrap();
            if claiming { break; }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    }).await.expect("claim must reach the fenced table");
    std::fs::write(config.control_file.as_ref().unwrap(), "drain").unwrap();
    tokio::time::sleep(Duration::from_millis(600)).await;
    assert_eq!(
        control::read_status(&config.control_status_file).unwrap(),
        Mode::Active
    );
    assert_eq!(started.load(Ordering::SeqCst), 0);
    fence.commit().await.unwrap();
    wait_mode(&config, Mode::Drain).await;
    wait_count(&started, 1).await;
    release.cancel();
    tokio::time::timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    assert_eq!(started.load(Ordering::SeqCst), 1);
    assert!(!interrupted.load(Ordering::SeqCst));
    let states: Vec<(String, i32)> =
        sqlx::query_as("SELECT status,attempts FROM jobs WHERE type=$1 ORDER BY status")
            .bind(kind)
            .fetch_all(&pool)
            .await
            .unwrap();
    assert_eq!(states, vec![("queued".into(), 0), ("succeeded".into(), 1)]);
    sqlx::query("DELETE FROM jobs WHERE type=$1")
        .bind(kind)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM workers WHERE id=$1")
        .bind(&config.worker_id)
        .execute(&pool)
        .await
        .unwrap();
    pool.close().await;
    std::fs::remove_dir_all(directory).unwrap();
}
