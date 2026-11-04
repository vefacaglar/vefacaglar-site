//! Background jobs worker (see `docs/jobs-worker.md`).
//!
//! The API enqueues rows in `jobs`; this worker claims them with
//! `FOR UPDATE SKIP LOCKED`, runs the registered [`handler::JobHandler`] and
//! records progress, checkpoints and logs back into Postgres.

pub mod backoff;
pub mod config;
pub mod context;
pub mod cron;
pub mod handler;
pub mod health;
pub mod jobs;
pub mod queue;
pub mod runner;
pub mod scheduler;
pub mod telemetry;

/// Version reported in the `workers` table: crate version plus the git commit
/// baked in at image build time (`WORKER_GIT_SHA`), when available.
pub fn version() -> String {
    match option_env!("WORKER_GIT_SHA") {
        Some(sha) if !sha.is_empty() => {
            let short: String = sha.chars().take(12).collect();
            format!("{}+{}", env!("CARGO_PKG_VERSION"), short)
        }
        _ => env!("CARGO_PKG_VERSION").to_string(),
    }
}
