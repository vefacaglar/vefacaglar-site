use std::backtrace::Backtrace;
use std::panic::Location;
use std::path::Path;
use std::process::ExitCode;
use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use tokio_util::sync::CancellationToken;
use worker::config::{self, Config, ConfigError};
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

#[derive(Debug, thiserror::Error)]
enum StartupError {
    #[error(transparent)]
    Config(#[from] ConfigError),
    #[error("connect to Postgres")]
    Connect(#[source] sqlx::Error),
    #[error("register worker in Postgres")]
    Register(#[source] sqlx::Error),
}

impl StartupError {
    // Only controlled descriptions and codes go to Log Tracker. The raw
    // database error may include credentials or server-side data.
    fn log_reason(&self) -> (String, String) {
        let (stage, error) = match self {
            Self::Config(ConfigError::MissingDatabaseUrl) => {
                return (
                    "missing_database_url".into(),
                    "DATABASE_URL is required.".into(),
                );
            }
            Self::Config(ConfigError::InvalidPoolSize(_)) => {
                return (
                    "invalid_db_pool_size".into(),
                    "WORKER_DB_POOL_MAX must be an unsigned integer.".into(),
                );
            }
            Self::Connect(error) => ("Could not connect to Postgres", error),
            Self::Register(error) => ("Could not register the worker in Postgres", error),
        };
        let (code, detail) = telemetry::database_error(error);
        (code, format!("{stage}: {detail}."))
    }
}

struct StartupFailure {
    error: StartupError,
    location: &'static Location<'static>,
    backtrace: Backtrace,
}

impl StartupFailure {
    #[track_caller]
    fn new(error: StartupError) -> Self {
        Self {
            error,
            location: Location::caller(),
            backtrace: Backtrace::force_capture(),
        }
    }
}

async fn run() -> Result<(), StartupFailure> {
    let config =
        Config::from_env().map_err(|error| StartupFailure::new(StartupError::Config(error)))?;
    if config.typesense.is_none() {
        tracing::warn!(
            application_event = "search_not_configured",
            "Typesense is not configured; search jobs will fail"
        );
    }
    let pool = PgPoolOptions::new()
        .max_connections(config.db_pool_max)
        .acquire_timeout(Duration::from_secs(30))
        .connect(&config.database_url)
        .await
        .map_err(|error| StartupFailure::new(StartupError::Connect(error)))?;

    let shutdown = CancellationToken::new();
    tokio::spawn(shutdown_signal(shutdown.clone()));

    let registry = jobs::registry(&config);
    Worker::new(pool.clone(), config, registry, shutdown)
        .run()
        .await
        .map_err(|error| StartupFailure::new(StartupError::Register(error)))?;
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
    let logs = telemetry::init();
    let status = match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(failure) => {
            let (code, reason) = failure.error.log_reason();
            let location = failure.location.to_string();
            let stack = telemetry::application_stack(&failure.backtrace);
            let diagnostic = telemetry::error_messages(&failure.error);
            tracing::error!(
                application_event = "worker_failed",
                error_code = code.as_str(),
                response_message = reason.as_str(),
                diagnostic = diagnostic.as_deref(),
                error_source = location.as_str(),
                origin_stack = stack.as_deref(),
                error = format!("{:#}", anyhow::Error::new(failure.error)),
                "worker failed"
            );
            ExitCode::FAILURE
        }
    };
    if let Some(logs) = logs {
        logs.close().await;
    }
    status
}
