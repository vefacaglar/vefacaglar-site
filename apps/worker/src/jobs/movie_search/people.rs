//! Movie people index. It runs inside `search.movies.sync`, after the movie
//! step, and rebuilds a full snapshot of searchable people into a fresh owned
//! build index, then swaps it with the stable uid `movie_people_en` that the
//! API queries. The API hydrates hits from PostgreSQL and falls back to SQL
//! search whenever this index is unavailable, so a snapshot may lag slightly.
//!
//! Durable progress lives in `movie_people_search_state`: the cursor advances
//! only after a batch was indexed, and the new snapshot becomes active only
//! once the scan is complete. The swap happens before the state is published;
//! a run resumed between the two sees the finished swap in Meilisearch's task
//! history and only publishes. The swapped-out build index (the previous
//! snapshot) is deleted right away: readers never query build indexes, so
//! `previous_collection` is no longer needed and stays NULL.
use std::time::Instant;

use anyhow::{Result, ensure};
use async_trait::async_trait;
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde_json::Value;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::super::search::backend::SearchBackend;
use super::super::search::{import_batch, settings};
use super::{Limits, current_index, delete_stale_builds, owned_with};
use crate::context::JobIo;
use crate::queue::LogLevel;

/// Stable index uid the API queries; also the state row id.
pub const PEOPLE_ALIAS: &str = "movie_people_en";
/// 2 = Meilisearch. Typesense-era state (1) starts a fresh build.
pub const PEOPLE_SCHEMA_VERSION: i32 = 2;
pub const PEOPLE_BATCH_SIZE: usize = 1000;
const PEOPLE_PREFIX: &str = "movie_people_en__build_";

/// A published snapshot is rebuilt once it is older than this.
pub fn refresh_interval() -> ChronoDuration {
    ChronoDuration::hours(12)
}

pub fn people_settings() -> Value {
    settings::for_index(PEOPLE_ALIAS)
}

pub fn people_owned(target: &str) -> bool {
    owned_with(PEOPLE_PREFIX, target)
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PeopleState {
    pub schema_version: i32,
    pub active_collection: Option<String>,
    pub building_collection: Option<String>,
    pub build_cursor: Option<Uuid>,
    pub published_at: Option<DateTime<Utc>>,
}

pub struct PeopleBatch {
    /// Documents for the searchable people among the selected IDs.
    pub docs: Vec<Value>,
    /// Last selected person ID, searchable or not (the keyset cursor).
    pub last_id: Option<Uuid>,
    pub selected: usize,
}

#[async_trait]
pub trait PeopleSource: Send + Sync {
    async fn state(&self) -> Result<PeopleState>;
    async fn start_build(&self, target: &str) -> Result<()>;
    async fn scan(&self, after: Option<Uuid>, limit: usize) -> Result<PeopleBatch>;
    async fn advance(&self, target: &str, cursor: Uuid) -> Result<()>;
    /// Marks the stable index active after `build` was swapped into it.
    async fn publish(&self, build: &str) -> Result<()>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PeopleOutcome {
    /// The active snapshot is fresh; nothing was done.
    Idle,
    /// A build is in progress and needs another run.
    Remaining,
    Published,
    Interrupted,
}

/// Publishes the swapped-in snapshot and drops the swapped-out one.
async fn publish(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    source: &dyn PeopleSource,
    build: &str,
) -> Result<PeopleOutcome> {
    source.publish(build).await?;
    if let Err(error) = backend.delete_index(build).await {
        io.log(
            LogLevel::Warn,
            &format!("movie people search: could not delete {build}: {error:#}"),
        )
        .await;
    }
    io.log(
        LogLevel::Info,
        &format!("movie people search ready: {build} swapped into {PEOPLE_ALIAS}"),
    )
    .await;
    Ok(PeopleOutcome::Published)
}

pub async fn run_people(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    source: &dyn PeopleSource,
    limits: Limits,
    now: DateTime<Utc>,
) -> Result<PeopleOutcome> {
    if io.should_stop() {
        return Ok(PeopleOutcome::Interrupted);
    }
    let deadline = Instant::now() + limits.duration;
    let state = source.state().await?;
    let settings = people_settings();
    let current = state.schema_version == PEOPLE_SCHEMA_VERSION;
    let building = state
        .building_collection
        .clone()
        .filter(|build| current && people_owned(build));
    // Crash between swap and publish: only the publish is missing.
    if let Some(build) = &building
        && backend.was_swapped(build).await?
    {
        return publish(io, backend, source, build).await;
    }
    let resumable = match &building {
        Some(build) => current_index(backend, build, &settings).await?,
        None => false,
    };
    let (target, mut cursor) = if let (true, Some(build)) = (resumable, building) {
        (build, state.build_cursor)
    } else {
        let fresh = current
            && state.building_collection.is_none()
            && state
                .published_at
                .is_some_and(|at| now - at < refresh_interval())
            && state.active_collection.as_deref() == Some(PEOPLE_ALIAS)
            && current_index(backend, PEOPLE_ALIAS, &settings).await?;
        if fresh {
            return Ok(PeopleOutcome::Idle);
        }
        // Persist the name before creating it; abandoned owned builds go.
        let target = format!("{PEOPLE_PREFIX}{}", Uuid::new_v4().simple());
        delete_stale_builds(io, backend, PEOPLE_PREFIX, None).await?;
        source.start_build(&target).await?;
        backend.create_index(&target, &settings).await?;
        (target, None)
    };

    let mut processed = 0;
    loop {
        if io.should_stop() {
            return Ok(PeopleOutcome::Interrupted);
        }
        if processed >= limits.documents || Instant::now() >= deadline {
            return Ok(PeopleOutcome::Remaining);
        }
        let batch = source.scan(cursor, PEOPLE_BATCH_SIZE).await?;
        if !batch.docs.is_empty() {
            import_batch(io, backend, &target, PEOPLE_ALIAS, &batch.docs).await?;
        }
        if let Some(last) = batch.last_id {
            source.advance(&target, last).await?;
            cursor = Some(last);
        }
        processed += batch.selected;
        if batch.selected < PEOPLE_BATCH_SIZE {
            break;
        }
    }

    backend.swap_indexes(&[(PEOPLE_ALIAS, &target)]).await?;
    publish(io, backend, source, &target).await
}

pub struct PgPeopleSource {
    pub pool: PgPool,
}

const STATE_COLUMNS: &str =
    "schema_version, active_collection, building_collection, build_cursor, published_at";

#[async_trait]
impl PeopleSource for PgPeopleSource {
    async fn state(&self) -> Result<PeopleState> {
        sqlx::query(
            "INSERT INTO movie_people_search_state (id) VALUES ($1) ON CONFLICT DO NOTHING",
        )
        .bind(PEOPLE_ALIAS)
        .execute(&self.pool)
        .await?;
        Ok(sqlx::query_as(&format!(
            "SELECT {STATE_COLUMNS} FROM movie_people_search_state WHERE id=$1"
        ))
        .bind(PEOPLE_ALIAS)
        .fetch_one(&self.pool)
        .await?)
    }
    async fn start_build(&self, target: &str) -> Result<()> {
        sqlx::query("UPDATE movie_people_search_state SET schema_version=$2, building_collection=$1, build_cursor=NULL, build_started_at=now(), updated_at=now() WHERE id=$3")
            .bind(target).bind(PEOPLE_SCHEMA_VERSION).bind(PEOPLE_ALIAS).execute(&self.pool).await?;
        Ok(())
    }
    async fn scan(&self, after: Option<Uuid>, limit: usize) -> Result<PeopleBatch> {
        // Keyset over every person, so the cursor never depends on visibility.
        // Searchable: a non-blank name and a non-deprecated credit on a public film.
        let rows = sqlx::query(
            r#"
          WITH ids AS MATERIALIZED (SELECT id FROM movie_people
            WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT $2)
          SELECT i.id, d.document FROM ids i LEFT JOIN LATERAL (
            SELECT jsonb_build_object('id', p.id::text, 'name', btrim(p.name),
              'publicCreditCount', count(DISTINCT c.movie_id)::int,
              'nameSort', lower(btrim(p.name))) AS document
            FROM movie_people p
            JOIN movie_credits c ON c.person_id=p.id AND c.rank <> 'deprecated'
            JOIN movies m ON m.id=c.movie_id
              AND m.is_film = true AND m.hydrated_at IS NOT NULL AND m.title IS NOT NULL
            WHERE p.id=i.id AND p.name IS NOT NULL AND btrim(p.name) <> ''
            GROUP BY p.id
          ) d ON true ORDER BY i.id
        "#,
        )
        .bind(after)
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await?;
        let mut docs = Vec::new();
        let mut last_id = None;
        for row in &rows {
            last_id = Some(row.try_get::<Uuid, _>("id")?);
            if let Some(document) = row.try_get::<Option<Value>, _>("document")? {
                docs.push(document);
            }
        }
        Ok(PeopleBatch {
            docs,
            last_id,
            selected: rows.len(),
        })
    }
    async fn advance(&self, target: &str, cursor: Uuid) -> Result<()> {
        let result = sqlx::query("UPDATE movie_people_search_state SET build_cursor=$2, updated_at=now() WHERE id=$3 AND building_collection=$1")
            .bind(target).bind(cursor).bind(PEOPLE_ALIAS).execute(&self.pool).await?;
        ensure!(
            result.rows_affected() == 1,
            "movie people build target changed"
        );
        Ok(())
    }
    async fn publish(&self, build: &str) -> Result<()> {
        // The snapshot is as fresh as its start, so the refresh clock uses it.
        let result = sqlx::query("UPDATE movie_people_search_state SET active_collection=$1, previous_collection=NULL, building_collection=NULL, build_cursor=NULL, published_at=coalesce(build_started_at, now()), updated_at=now() WHERE id=$1 AND building_collection=$2")
            .bind(PEOPLE_ALIAS).bind(build).execute(&self.pool).await?;
        ensure!(
            result.rows_affected() == 1,
            "movie people build target changed"
        );
        Ok(())
    }
}
