//! One durable run remains alive across long work and resumes after OS shutdown.
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde_json::json;
use sqlx::PgPool;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::Duration;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;
use worker::config::Config;
use worker::context::{JobContext, Progress};
use worker::control::{self, Mode};
use worker::handler::{JobHandler, JobOutcome, Registry};
use worker::runner::Worker;

static TV_LIFECYCLE_FIXTURE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

struct CampaignFixture {
    kind: &'static str,
    id: Uuid,
    started: Arc<AtomicUsize>,
    resumed: Arc<AtomicBool>,
    release: CancellationToken,
}
#[async_trait]
impl JobHandler for CampaignFixture {
    fn job_type(&self) -> &'static str {
        self.kind
    }
    async fn run(&self, ctx: &JobContext) -> anyhow::Result<JobOutcome> {
        assert_eq!(ctx.job_id(), self.id);
        assert_eq!(ctx.attempt(), 1);
        if ctx.checkpoint() == Some(&json!({"cohort":7})) {
            self.resumed.store(true, Ordering::SeqCst);
        }
        ctx.save_checkpoint(
            &Progress {
                phase: Some("tv:fixture".into()),
                ..Default::default()
            },
            &json!({"cohort":7}),
        )
        .await?;
        self.started.fetch_add(1, Ordering::SeqCst);
        loop {
            if ctx.should_stop() {
                return Ok(JobOutcome::Interrupted);
            }
            tokio::select! {
                _ = self.release.cancelled() => return Ok(JobOutcome::Completed),
                _ = tokio::time::sleep(Duration::from_millis(25)) => {},
            }
        }
    }
}
fn registry(
    kind: &'static str,
    id: Uuid,
    started: Arc<AtomicUsize>,
    resumed: Arc<AtomicBool>,
    release: CancellationToken,
) -> Registry {
    let mut registry = Registry::new();
    registry.register(CampaignFixture {
        kind,
        id,
        started,
        resumed,
        release,
    });
    registry
}
async fn wait_count(started: &AtomicUsize, count: usize) {
    tokio::time::timeout(Duration::from_secs(5), async {
        while started.load(Ordering::SeqCst) < count {
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .unwrap();
}
#[tokio::test]
async fn an_aged_job_heartbeats_and_resumes_the_same_id_before_natural_drain() {
    let _fixture = TV_LIFECYCLE_FIXTURE.lock().await;
    let Ok(url) = std::env::var("WORKER_TEST_DATABASE_URL") else {
        return;
    };
    let pool = PgPool::connect(&url).await.unwrap();
    let id = Uuid::new_v4();
    let kind: &'static str = Box::leak(format!("test.tv.lifecycle.{id}").into_boxed_str());
    let directory = std::env::temp_dir().join(kind);
    std::fs::create_dir_all(&directory).unwrap();
    let config = |name: &str| Config {
        database_url: url.clone(),
        db_pool_max: 5,
        concurrency: 4,
        worker_id: format!("{kind}-{name}"),
        hostname: "tv-lifecycle-fixture".into(),
        health_file: directory.join(format!("{name}.health")),
        control_file: Some(directory.join(format!("{name}.mode"))),
        control_status_file: directory.join(format!("{name}.state")),
        meilisearch: None,
    };
    let old = config("old");
    let new = config("new");
    std::fs::write(old.control_file.as_ref().unwrap(), "active").unwrap();
    std::fs::write(new.control_file.as_ref().unwrap(), "active").unwrap();
    sqlx::query(
        "INSERT INTO jobs(id,type,payload,started_at) VALUES($1,$2,'{}',now()-interval '3 days')",
    )
    .bind(id)
    .bind(kind)
    .execute(&pool)
    .await
    .unwrap();
    let started = Arc::new(AtomicUsize::new(0));
    let resumed = Arc::new(AtomicBool::new(false));
    let release = CancellationToken::new();
    let shutdown = CancellationToken::new();
    let task = tokio::spawn(
        Worker::new(
            pool.clone(),
            old.clone(),
            registry(kind, id, started.clone(), resumed.clone(), release.clone()),
            shutdown.clone(),
        )
        .run(),
    );
    wait_count(&started, 1).await;
    let before: DateTime<Utc> = sqlx::query_scalar("SELECT heartbeat_at FROM jobs WHERE id=$1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
    tokio::time::sleep(Duration::from_secs(11)).await;
    let (status, after): (String, DateTime<Utc>) =
        sqlx::query_as("SELECT status,heartbeat_at FROM jobs WHERE id=$1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status, "running");
    assert!(after > before);
    shutdown.cancel();
    tokio::time::timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    let (status, attempts, checkpoint): (String, i32, serde_json::Value) =
        sqlx::query_as("SELECT status,attempts,checkpoint FROM jobs WHERE id=$1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(status, "queued");
    assert_eq!(attempts, 0);
    assert_eq!(checkpoint, json!({"cohort":7}));
    let task = tokio::spawn(
        Worker::new(
            pool.clone(),
            new.clone(),
            registry(kind, id, started.clone(), resumed.clone(), release.clone()),
            CancellationToken::new(),
        )
        .run(),
    );
    wait_count(&started, 2).await;
    assert!(resumed.load(Ordering::SeqCst));
    std::fs::write(new.control_file.as_ref().unwrap(), "drain").unwrap();
    tokio::time::timeout(Duration::from_secs(5), async {
        while control::read_status(&new.control_status_file) != Ok(Mode::Drain) {
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .unwrap();
    release.cancel();
    tokio::time::timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    let (status, count): (String, i64) = sqlx::query_as(
        "SELECT status,(SELECT count(*) FROM jobs WHERE type=$2) FROM jobs WHERE id=$1",
    )
    .bind(id)
    .bind(kind)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(status, "succeeded");
    assert_eq!(count, 1);
    sqlx::query("DELETE FROM jobs WHERE id=$1")
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM workers WHERE id=ANY($1)")
        .bind([old.worker_id, new.worker_id])
        .execute(&pool)
        .await
        .unwrap();
    pool.close().await;
    std::fs::remove_dir_all(directory).unwrap();
}

struct IndependentTvWork {
    kind: &'static str,
    key: &'static str,
    release: CancellationToken,
}
#[async_trait]
impl JobHandler for IndependentTvWork {
    fn job_type(&self) -> &'static str {
        self.kind
    }
    fn concurrency_key(&self, _: &serde_json::Value) -> Option<String> {
        Some(self.key.into())
    }
    async fn run(&self, ctx: &JobContext) -> anyhow::Result<JobOutcome> {
        let mut processed = 0;
        loop {
            if ctx.should_stop() {
                return Ok(JobOutcome::Interrupted);
            }
            processed += 1;
            ctx.progress(&Progress {
                processed: Some(processed),
                ..Default::default()
            })
            .await?;
            tokio::select! {
                _ = self.release.cancelled() => return Ok(JobOutcome::Completed),
                _ = tokio::time::sleep(Duration::from_millis(50)) => {},
            }
        }
    }
}
#[tokio::test]
async fn three_independent_tv_types_make_progress_in_one_four_slot_worker() {
    let _fixture = TV_LIFECYCLE_FIXTURE.lock().await;
    let Ok(url) = std::env::var("WORKER_TEST_DATABASE_URL") else {
        return;
    };
    let pool = PgPool::connect(&url).await.unwrap();
    let directory = std::env::temp_dir().join(format!("test.tv.overlap.{}", Uuid::new_v4()));
    std::fs::create_dir_all(&directory).unwrap();
    let config = Config {
        database_url: url,
        db_pool_max: 5,
        concurrency: 4,
        worker_id: format!("tv-overlap-{}", Uuid::new_v4()),
        hostname: "tv-overlap-fixture".into(),
        health_file: directory.join("health"),
        control_file: Some(directory.join("mode")),
        control_status_file: directory.join("state"),
        meilisearch: None,
    };
    std::fs::write(config.control_file.as_ref().unwrap(), "active").unwrap();
    let release = CancellationToken::new();
    let mut registry = Registry::new();
    let mut ids = Vec::<Uuid>::new();
    for (kind, key) in [
        ("catalog.tv-series.sync", "catalog.tv-series"),
        ("catalog.tv-series.cast.refresh", "catalog.tv-series.cast"),
        ("search.tv-series.sync", "search.tv-series.index"),
    ] {
        registry.register(IndependentTvWork {
            kind,
            key,
            release: release.clone(),
        });
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO jobs(type,payload,concurrency_key) VALUES($1,'{}',$2) RETURNING id",
        )
        .bind(kind)
        .bind(key)
        .fetch_one(&pool)
        .await
        .unwrap();
        ids.push(id);
    }
    let task = tokio::spawn(
        Worker::new(
            pool.clone(),
            config.clone(),
            registry,
            CancellationToken::new(),
        )
        .run(),
    );
    tokio::time::timeout(Duration::from_secs(5),async {
        loop {
            let progressed: i64 = sqlx::query_scalar("SELECT count(*) FROM jobs WHERE id=ANY($1) AND status='running' AND (progress->>'processed')::int>=3 AND locked_by=$2")
                .bind(&ids).bind(&config.worker_id).fetch_one(&pool).await.unwrap();
            if progressed == 3 { break; }
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    }).await.expect("all three independent TV jobs must progress while holding separate slots");
    std::fs::write(config.control_file.as_ref().unwrap(), "drain").unwrap();
    tokio::time::timeout(Duration::from_secs(5), async {
        while control::read_status(&config.control_status_file) != Ok(Mode::Drain) {
            tokio::time::sleep(Duration::from_millis(25)).await;
        }
    })
    .await
    .unwrap();
    release.cancel();
    tokio::time::timeout(Duration::from_secs(5), task)
        .await
        .unwrap()
        .unwrap()
        .unwrap();
    let completed: i64 =
        sqlx::query_scalar("SELECT count(*) FROM jobs WHERE id=ANY($1) AND status='succeeded'")
            .bind(&ids)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(completed, 3);
    sqlx::query("DELETE FROM jobs WHERE id=ANY($1)")
        .bind(&ids)
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
