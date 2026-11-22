//! Dedicated movie index owner. Durable progress belongs to movie_search_state,
//! rather than a job ID; no generic search job touches these indexes.
//!
//! The API always queries the stable uid `movies_en`. A (re)build loads a
//! fresh `movies_en__build_<uuid>` index (`building_collection`), replays the
//! ledger into it, commits the publication decision (`bootstrap_phase =
//! 'swap'`), swaps it with `movies_en` in Meilisearch and only then marks the
//! state ready with `active_collection = 'movies_en'`. Steady-state runs write
//! straight into `movies_en`.

pub mod people;
#[cfg(test)]
mod people_tests;
pub mod source;
#[cfg(test)]
mod tests;

use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{Result, bail};
use async_trait::async_trait;
use chrono::{Duration as ChronoDuration, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

use super::search::backend::{MeilisearchClient, SearchBackend, settings_match};
use super::search::{import_batch, settings};
use crate::config::MeilisearchConfig;
use crate::context::{JobContext, JobIo, Progress};
use crate::handler::{JobHandler, JobOutcome, PermanentError};
use crate::queue::LogLevel;
use crate::telemetry::log_safe;
use people::PeopleOutcome;
use source::{Batch, MovieSource, PgMovieSource, Publication, State};

/// Stable index uid the API queries; also the state row id.
pub const ALIAS: &str = "movies_en";
/// 3 = Meilisearch. Typesense-era state (2) starts a fresh build.
pub const SCHEMA_VERSION: i32 = 4;
pub const BATCH_SIZE: usize = 500;
const BUILD_PREFIX: &str = "movies_en__build_";

pub fn index_settings() -> Value {
    settings::parse(include_str!("../search/meili/movies_en.json"))
}

/// Build indexes owned by this job: `movies_en__build_<alnum>`.
pub fn owned(target: &str) -> bool {
    owned_with(BUILD_PREFIX, target)
}

pub(crate) fn owned_with(prefix: &str, target: &str) -> bool {
    target.strip_prefix(prefix).is_some_and(|suffix| {
        !suffix.is_empty() && suffix.bytes().all(|b| b.is_ascii_alphanumeric())
    })
}

/// Whether `uid` exists with the contract's settings.
pub(crate) async fn current_index(
    backend: &dyn SearchBackend,
    uid: &str,
    expected: &Value,
) -> Result<bool> {
    Ok(backend
        .settings(uid)
        .await?
        .is_some_and(|actual| settings_match(&actual, expected)))
}

/// Deletes owned build indexes other than `keep` (abandoned or already
/// swapped-out generations). The API never queries build indexes.
pub(crate) async fn delete_stale_builds(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    prefix: &str,
    keep: Option<&str>,
) -> Result<()> {
    for name in backend.list_indexes().await? {
        if owned_with(prefix, &name)
            && Some(name.as_str()) != keep
            && let Err(error) = backend.delete_index(&name).await
        {
            io.log(
                LogLevel::Warn,
                &format!(
                    "could not delete stale build index {name}: {}",
                    log_safe(&error)
                ),
            )
            .await;
        }
    }
    Ok(())
}

pub struct MovieSearchHandler {
    pub meilisearch: Arc<Option<MeilisearchConfig>>,
}

#[async_trait]
impl JobHandler for MovieSearchHandler {
    fn job_type(&self) -> &'static str {
        "search.movies.sync"
    }
    fn concurrency_key(&self, _payload: &Value) -> Option<String> {
        Some(super::search::CONCURRENCY_KEY.into())
    }
    async fn run(&self, ctx: &JobContext) -> Result<JobOutcome> {
        super::search::full::validate_payload(ctx.payload())
            .map_err(|error| PermanentError::err(error.to_string()))?;
        let config = super::search::meilisearch_config(&self.meilisearch)?;
        let backend = MeilisearchClient::with_timeouts(
            config,
            Duration::from_secs(20),
            Duration::from_secs(120),
        )?;
        let movies = run(
            ctx,
            &backend,
            &PgMovieSource {
                pool: ctx.pool().clone(),
            },
            Limits::default(),
        )
        .await?;
        if movies == JobOutcome::Interrupted {
            return Ok(movies);
        }
        // The people index is auxiliary (the API falls back to SQL), so its
        // failure is logged and never fails or delays the movie index.
        let people = match people::run_people(
            ctx,
            &backend,
            &people::PgPeopleSource {
                pool: ctx.pool().clone(),
            },
            Limits::people(),
            Utc::now(),
        )
        .await
        {
            Ok(outcome) => outcome,
            Err(error) => {
                // Scoped: the borrowed `dyn Error` must not live across an await.
                {
                    let cause: &(dyn std::error::Error + 'static) = error.as_ref();
                    let stack = crate::telemetry::application_stack(error.backtrace());
                    tracing::error!(
                        application_event = "movie_people_search_failed",
                        job_id = %ctx.job_id(),
                        error = cause,
                        origin_stack = stack.as_deref(),
                        "movie people search failed"
                    );
                }
                ctx.log(
                    LogLevel::Error,
                    &format!("movie people search failed: {}", log_safe(&error)),
                )
                .await;
                PeopleOutcome::Idle
            }
        };
        Ok(combine(movies, people))
    }
}

/// One job outcome for the movie step followed by the people step.
pub fn combine(movies: JobOutcome, people: PeopleOutcome) -> JobOutcome {
    match (movies, people) {
        (JobOutcome::Interrupted, _) | (_, PeopleOutcome::Interrupted) => JobOutcome::Interrupted,
        (JobOutcome::Completed, PeopleOutcome::Remaining) => {
            JobOutcome::CompletedWithContinuation {
                run_at: Utc::now() + ChronoDuration::seconds(30),
            }
        }
        (movies, _) => movies,
    }
}

#[derive(Clone, Copy)]
pub struct Limits {
    pub documents: usize,
    pub duration: Duration,
}
impl Limits {
    /// Budget for the people step that follows the movie step in the same run.
    pub fn people() -> Self {
        Self {
            documents: 100_000,
            duration: Duration::from_secs(60),
        }
    }
}
impl Default for Limits {
    fn default() -> Self {
        Self {
            documents: 50_000,
            duration: Duration::from_secs(90),
        }
    }
}

async fn prepare(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    source: &dyn MovieSource,
) -> Result<State> {
    let state = source.state().await?;
    let settings = index_settings();
    if state.schema_version == SCHEMA_VERSION {
        let usable = match (state.building_collection.as_deref(), state.phase.as_str()) {
            // The publication decision is durable; the swap finishes it, as
            // long as it already happened or the build is still there to swap.
            (Some(build), "swap") => {
                owned(build)
                    && (backend.was_swapped(build).await?
                        || current_index(backend, build, &settings).await?)
            }
            (Some(build), "scan" | "replay") => {
                owned(build) && current_index(backend, build, &settings).await?
            }
            (None, "ready") => {
                state.active_collection.as_deref() == Some(ALIAS)
                    && current_index(backend, ALIAS, &settings).await?
            }
            _ => false,
        };
        if usable {
            // Retries a failed delete of a swapped-out or abandoned build.
            delete_stale_builds(
                io,
                backend,
                BUILD_PREFIX,
                state.building_collection.as_deref(),
            )
            .await?;
            return Ok(state);
        }
    }
    // Persist the new name before creation. A missing or outdated index (or
    // Typesense-era state) starts a fresh generation; the live `movies_en`
    // keeps serving whatever it holds until the new build is swapped in.
    let target = format!("{BUILD_PREFIX}{}", Uuid::new_v4().simple());
    delete_stale_builds(io, backend, BUILD_PREFIX, None).await?;
    source.start_build(&target).await?;
    backend.create_index(&target, &settings).await?;
    io.log(
        LogLevel::Info,
        &format!("movie search build started in {target}"),
    )
    .await;
    source.state().await
}

/// Swaps the decided build into `movies_en` (once; a crash-resumed run sees
/// the finished swap in Meilisearch's task history), then marks the state
/// ready. `ranking_ready` stays false until the steady-state loop drains any
/// rows dirtied meanwhile and publishes.
async fn finish_swap(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    source: &dyn MovieSource,
    build: &str,
) -> Result<()> {
    if !backend.was_swapped(build).await? {
        backend.swap_indexes(&[(ALIAS, build)]).await?;
    }
    source.finish_swap(build).await?;
    // After the swap the build uid holds the previous generation (or nothing,
    // when the first build was renamed into place).
    if let Err(error) = backend.delete_index(build).await {
        io.log(
            LogLevel::Warn,
            &format!(
                "movie search: could not delete swapped-out {build}: {}",
                log_safe(&error)
            ),
        )
        .await;
    }
    io.log(
        LogLevel::Info,
        &format!("movie search swapped {build} into {ALIAS}"),
    )
    .await;
    Ok(())
}

async fn apply(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    source: &dyn MovieSource,
    target: &str,
    batch: &Batch,
) -> Result<()> {
    let docs: Vec<Value> = batch
        .rows
        .iter()
        .filter_map(|row| row.document.clone())
        .collect();
    import_batch(io, backend, target, ALIAS, &docs).await?;
    let tombstones: Vec<String> = batch
        .rows
        .iter()
        .filter(|row| row.document.is_none())
        .map(|row| row.id.to_string())
        .collect();
    backend.delete_documents(target, &tombstones).await?;
    // No state lock follows ledger locks in this transaction. Cursor/state
    // advancement is a separate commit; replay after a crash is idempotent.
    source.ack(target, &batch.rows).await?;
    Ok(())
}

async fn report(io: &dyn JobIo, state: &State, processed: usize) -> Result<()> {
    let progress = Progress {
        phase: Some(state.phase.clone()),
        processed: Some(processed as u64),
        message: Some(format!(
            "{processed} movie documents synchronized; durable phase {}",
            state.phase
        )),
        ..Default::default()
    };
    io.checkpoint(
        &progress,
        json!({ "stateId": ALIAS, "phase": state.phase,
        "target": state.target(), "cursor": state.cursor }),
    )
    .await
}

fn outcome(progress: bool, remaining: bool) -> JobOutcome {
    if progress && remaining {
        JobOutcome::CompletedWithContinuation {
            run_at: Utc::now() + ChronoDuration::seconds(30),
        }
    } else {
        JobOutcome::Completed
    }
}

pub async fn run(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    source: &dyn MovieSource,
    limits: Limits,
) -> Result<JobOutcome> {
    if io.should_stop() {
        return Ok(JobOutcome::Interrupted);
    }
    let deadline = Instant::now() + limits.duration;
    let mut state = prepare(io, backend, source).await?;
    let mut processed = 0;
    let mut progressed = false;
    if state.phase == "swap" {
        let build = state
            .building_collection
            .clone()
            .ok_or_else(|| anyhow::anyhow!("movie search swap target missing"))?;
        finish_swap(io, backend, source, &build).await?;
        state = source.state().await?;
        progressed = true;
    }
    let mut target = state
        .target()
        .ok_or_else(|| anyhow::anyhow!("movie search target missing"))?
        .to_owned();
    let mut publication: Option<Publication> = None;
    loop {
        if io.should_stop() {
            return Ok(JobOutcome::Interrupted);
        }
        if processed >= limits.documents || Instant::now() >= deadline {
            return Ok(outcome(progressed, source.remaining(&target).await?));
        }
        if state.phase == "scan" {
            let batch = source.scan(state.cursor, BATCH_SIZE).await?;
            apply(io, backend, source, &target, &batch).await?;
            publication = Some(batch.publication);
            source
                .advance_scan(&target, batch.last_id, batch.rows.len() < BATCH_SIZE)
                .await?;
            processed += batch.rows.len();
            progressed = true;
        } else {
            // Replay all mismatched targets when building, but use the partial
            // pending index for normal five-minute steady-state runs.
            let batch = source
                .dirty(&target, state.building_collection.is_some(), BATCH_SIZE)
                .await?;
            if !batch.rows.is_empty() {
                apply(io, backend, source, &target, &batch).await?;
                publication = Some(batch.publication);
                processed += batch.rows.len();
                progressed = true;
            } else {
                // The empty batch's generation/date is captured by the same
                // statement as its candidate selection, including an empty DB.
                let candidate = batch.publication;
                if publication.is_some_and(|previous| previous != candidate) {
                    // A ranking publisher raced the last batch. Its transaction
                    // dirties the entire affected union; drain again first.
                    publication = Some(candidate);
                    continue;
                }
                if state.building_collection.is_some() {
                    // Commit the decision under the state lock, then swap
                    // without holding it. A crash leaves phase 'swap', which
                    // the next run finishes without rescanning.
                    if !source.begin_swap(&target, candidate).await? {
                        publication = None;
                        continue;
                    }
                    finish_swap(io, backend, source, &target).await?;
                    state = source.state().await?;
                    target = ALIAS.to_owned();
                    publication = None;
                    progressed = true;
                    report(io, &state, processed).await?;
                    // Drain rows dirtied since the decision, then publish.
                    continue;
                }
                if !source.publish(&target, candidate).await? {
                    // A concurrent rank publication/pending revision
                    // invalidated the check. No continuation without progress.
                    publication = None;
                    continue;
                }
                state = source.state().await?;
                if source.repair_due().await? {
                    let examined = source.repair(BATCH_SIZE).await?;
                    processed += examined;
                    progressed = true; // repair marker committed, even at EOF
                    report(io, &state, processed).await?;
                    continue;
                }
                report(io, &state, processed).await?;
                io.log(
                    LogLevel::Info,
                    &format!("movie search ready: {processed} documents synchronized in {target}"),
                )
                .await;
                return Ok(JobOutcome::Completed);
            }
        }
        state = source.state().await?;
        if state.target() != Some(target.as_str()) {
            bail!("movie search target changed while running");
        }
        report(io, &state, processed).await?;
    }
}
