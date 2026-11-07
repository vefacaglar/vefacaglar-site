//! Dedicated movie index owner. Durable progress belongs to movie_search_state,
//! rather than a job ID; no generic search job touches these collections.

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

use super::search::backend::{SearchBackend, TypesenseClient};
use super::search::import_batch;
use crate::config::TypesenseConfig;
use crate::context::{JobContext, JobIo, Progress};
use crate::handler::{JobHandler, JobOutcome, PermanentError};
use crate::queue::LogLevel;
use source::{Batch, MovieSource, PgMovieSource, Publication, State};

pub const ALIAS: &str = "movies_en";
pub const SCHEMA_VERSION: i32 = 1;
pub const BATCH_SIZE: usize = 500;
const PREFIX: &str = "movies_en__v1_";
const SCHEMA: &str =
    include_str!("../../../../api/src/modules/movies/search/movie-search.schema.json");

pub fn schema(target: &str) -> Value {
    let mut schema: Value = serde_json::from_str(SCHEMA).expect("movie schema JSON");
    schema["name"] = json!(target);
    schema
}

pub fn owned(target: &str) -> bool {
    target.strip_prefix(PREFIX).is_some_and(|suffix| {
        !suffix.is_empty()
            && suffix
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_')
    })
}

/// Typesense adds defaults to returned schemas. Compare all contract properties
/// and their relevant defaults, while accepting those server-added properties.
pub fn compatible(actual: &Value, target: &str) -> bool {
    let expected = schema(target);
    if actual["name"] != expected["name"]
        || actual["default_sorting_field"] != expected["default_sorting_field"]
    {
        return false;
    }
    let Some(fields) = actual["fields"].as_array() else {
        return false;
    };
    let wanted = expected["fields"].as_array().expect("schema fields");
    if fields.len() != wanted.len() {
        return false;
    }
    wanted.iter().all(|field| {
        fields
            .iter()
            .find(|candidate| candidate["name"] == field["name"])
            .is_some_and(|candidate| {
                candidate["type"] == field["type"]
                    && ["optional", "facet", "sort"].into_iter().all(|key| {
                        // Numeric fields are sortable by default in Typesense.
                        let default = key == "sort" && field["type"] == "int32";
                        candidate[key].as_bool().unwrap_or(default)
                            == field[key].as_bool().unwrap_or(default)
                    })
                    && candidate["index"].as_bool().unwrap_or(true)
            })
    })
}

pub struct MovieSearchHandler {
    pub typesense: Arc<Option<TypesenseConfig>>,
}

#[async_trait]
impl JobHandler for MovieSearchHandler {
    fn job_type(&self) -> &'static str {
        "search.movies.sync"
    }
    fn concurrency_key(&self, _payload: &Value) -> Option<String> {
        Some("search.index".into())
    }
    async fn run(&self, ctx: &JobContext) -> Result<JobOutcome> {
        super::search::full::validate_payload(ctx.payload())
            .map_err(|error| PermanentError::err(error.to_string()))?;
        let config = self.typesense.as_ref().as_ref().ok_or_else(|| {
            PermanentError::err(
                "Typesense is not configured (set TYPESENSE_HOST and TYPESENSE_API_KEY)",
            )
        })?;
        let backend = TypesenseClient::with_timeout(config, Duration::from_secs(20))?;
        run(
            ctx,
            &backend,
            &PgMovieSource {
                pool: ctx.pool().clone(),
            },
            Limits::default(),
        )
        .await
    }
}

#[derive(Clone, Copy)]
pub struct Limits {
    pub documents: usize,
    pub duration: Duration,
}
impl Default for Limits {
    fn default() -> Self {
        Self {
            documents: 50_000,
            duration: Duration::from_secs(90),
        }
    }
}

async fn valid_target(backend: &dyn SearchBackend, target: Option<&str>) -> Result<bool> {
    let Some(target) = target.filter(|target| owned(target)) else {
        return Ok(false);
    };
    Ok(backend
        .collection_schema(target)
        .await?
        .is_some_and(|value| compatible(&value, target)))
}

async fn prepare(backend: &dyn SearchBackend, source: &dyn MovieSource) -> Result<State> {
    let state = source.state().await?;
    let target = state
        .building_collection
        .as_deref()
        .or(state.active_collection.as_deref());
    if state.schema_version == SCHEMA_VERSION
        && valid_target(backend, target).await?
        && ((state.building_collection.is_some()
            && matches!(state.phase.as_str(), "scan" | "replay"))
            || (state.building_collection.is_none() && state.phase == "ready"))
    {
        return Ok(state);
    }
    // Persist the new name before creation. A missing or incompatible target
    // starts a fresh generation; unknown physical collections are never deleted.
    let target = format!("{PREFIX}{}", Uuid::new_v4().simple());
    source.start_build(&target).await?;
    backend.create_collection(&schema(&target)).await?;
    source.state().await
}

async fn apply(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    source: &dyn MovieSource,
    target: &str,
    batch: &Batch,
    deadline: Instant,
) -> Result<bool> {
    let docs: Vec<Value> = batch
        .rows
        .iter()
        .filter_map(|row| row.document.clone())
        .collect();
    import_batch(io, backend, target, ALIAS, &docs).await?;
    for row in batch.rows.iter().filter(|row| row.document.is_none()) {
        if io.should_stop() || Instant::now() >= deadline {
            return Ok(false);
        }
        backend.delete_document(target, &row.id.to_string()).await?;
    }
    // No state lock follows ledger locks in this transaction. Cursor/state
    // advancement is a separate commit; replay after a crash is idempotent.
    source.ack(target, &batch.rows).await?;
    Ok(true)
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
    let mut state = prepare(backend, source).await?;
    let target = state
        .target()
        .ok_or_else(|| anyhow::anyhow!("movie search target missing"))?
        .to_owned();
    let mut processed = 0;
    let mut progressed = false;
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
            if !apply(io, backend, source, &target, &batch, deadline).await? {
                if io.should_stop() {
                    return Ok(JobOutcome::Interrupted);
                }
                return Ok(outcome(progressed, true));
            }
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
                if !apply(io, backend, source, &target, &batch, deadline).await? {
                    if io.should_stop() {
                        return Ok(JobOutcome::Interrupted);
                    }
                    return Ok(outcome(progressed, true));
                }
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
                if source.can_publish(&target, candidate).await? {
                    // Network never runs while holding the publication row lock.
                    // A crash here leaves building_collection and replay intact.
                    if backend.get_alias(ALIAS).await?.as_deref() != Some(&target) {
                        backend.upsert_alias(ALIAS, &target).await?;
                    }
                    if !source.publish(&target, candidate).await? {
                        publication = None;
                        continue;
                    }
                    // No broad cleanup: retained old targets can be inspected
                    // and only a separately authorized owned-generation cleanup
                    // may remove them.
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
                        &format!(
                            "movie search ready: {processed} documents synchronized in {target}"
                        ),
                    )
                    .await;
                    return Ok(JobOutcome::Completed);
                }
                // A concurrent rank publication/pending revision invalidated
                // the preflight. No continuation is emitted without progress.
                publication = None;
                continue;
            }
        }
        state = source.state().await?;
        if state.target() != Some(target.as_str()) {
            bail!("movie search target changed while running");
        }
        report(io, &state, processed).await?;
    }
}
