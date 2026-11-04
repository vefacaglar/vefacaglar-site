use std::path::Path;
use std::process::ExitCode;
use std::time::Duration;

use anyhow::{Context, Result};
use sqlx::postgres::PgPoolOptions;
use tokio_util::sync::CancellationToken;
use worker::config::{self, Config};
use worker::runner::Worker;
use worker::{health, jobs, telemetry};

fn load_dotenv() {
    // Local development only: the repo-root .env (production containers get
    // their environment from compose). Never overrides existing variables.
    let manifest = Path::new(env!("CARGO_MANIFEST_DIR"));
    for candidate in [manifest.join("../../.env"), manifest.join(".env")] {
        if candidate.is_file() {
            let _ = dotenvy::from_path(&candidate);
        }
    }
}

fn healthcheck() -> ExitCode {
    let path = config::health_file_from_env();
    match health::check(&path, chrono::Utc::now().timestamp()) {
        Ok(age) => {
            println!("healthy (heartbeat {age}s ago)");
            ExitCode::SUCCESS
        }
        Err(reason) => {
            eprintln!("unhealthy: {reason}");
            ExitCode::FAILURE
        }
    }
}

async fn shutdown_signal(token: CancellationToken) {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};
        let mut term = signal(SignalKind::terminate()).expect("install SIGTERM handler");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => tracing::info!("SIGINT received; shutting down"),
            _ = term.recv() => tracing::info!("SIGTERM received; shutting down"),
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
        tracing::info!("Ctrl-C received; shutting down");
    }
    token.cancel();
}

async fn run() -> Result<()> {
    let config = Config::from_env()?;
    if config.typesense.is_none() {
        tracing::warn!("Typesense is not configured; search jobs will fail");
    }
    let pool = PgPoolOptions::new()
        .max_connections(config.db_pool_max)
        .acquire_timeout(Duration::from_secs(30))
        .connect(&config.database_url)
        .await
        .context("connect to DATABASE_URL")?;

    let shutdown = CancellationToken::new();
    tokio::spawn(shutdown_signal(shutdown.clone()));

    let registry = jobs::registry(&config);
    Worker::new(pool.clone(), config, registry, shutdown)
        .run()
        .await?;
    pool.close().await;
    Ok(())
}

#[tokio::main]
async fn main() -> ExitCode {
    if std::env::args().skip(1).any(|a| a == "--healthcheck") {
        return healthcheck();
    }
    if std::env::args().skip(1).any(|a| a == "--version") {
        println!("worker {}", worker::version());
        return ExitCode::SUCCESS;
    }
    load_dotenv();
    telemetry::init();
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            tracing::error!(error = format!("{e:#}"), "worker failed");
            ExitCode::FAILURE
        }
    }
}
