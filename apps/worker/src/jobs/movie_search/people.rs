//! Movie people index. It runs inside `search.movies.sync`, after the movie
//! step, and rebuilds a full snapshot of searchable people into a fresh owned
//! collection. The API hydrates hits from PostgreSQL and falls back to SQL
//! search whenever this index is unavailable, so a snapshot may lag slightly.
//!
//! Durable progress lives in `movie_people_search_state`: the cursor advances
//! only after a batch was imported, the new generation becomes active only once
//! the scan is complete, and the replaced generation is kept until the next
//! publish (so readers that just resolved it never hit a deleted collection);
//! only the owned generation before that is deleted.
use std::time::Instant;

use anyhow::{Result, ensure};
use async_trait::async_trait;
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use serde_json::{Value, json};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use super::super::search::backend::SearchBackend;
use super::super::search::import_batch;
use super::Limits;
use crate::context::JobIo;
use crate::queue::LogLevel;

pub const PEOPLE_ALIAS: &str = "movie_people_en";
pub const PEOPLE_SCHEMA_VERSION: i32 = 1;
pub const PEOPLE_BATCH_SIZE: usize = 1000;
const PEOPLE_PREFIX: &str = "movie_people_en__v1_";
const PEOPLE_SCHEMA: &str =
    include_str!("../../../../api/src/modules/movies/search/movie-people-search.schema.json");

/// A published snapshot is rebuilt once it is older than this.
pub fn refresh_interval() -> ChronoDuration {
    ChronoDuration::hours(12)
}

pub fn people_schema(target: &str) -> Value {
    let mut schema: Value = serde_json::from_str(PEOPLE_SCHEMA).expect("people schema JSON");
    schema["name"] = json!(target);
    schema
}

pub fn people_owned(target: &str) -> bool {
    target.strip_prefix(PEOPLE_PREFIX).is_some_and(|suffix| {
        !suffix.is_empty()
            && suffix
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_')
    })
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
    /// Activates `target`, keeps the replaced generation as `previous_collection`,
    /// and returns the generation that was previous before (now safe to delete).
    async fn publish(&self, target: &str) -> Result<Option<String>>;
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

async fn valid_target(backend: &dyn SearchBackend, target: Option<&str>) -> Result<bool> {
    let Some(target) = target.filter(|target| people_owned(target)) else {
        return Ok(false);
    };
    Ok(backend
        .collection_schema(target)
        .await?
        .is_some_and(|value| super::compatible_with(&value, &people_schema(target))))
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
    let current = state.schema_version == PEOPLE_SCHEMA_VERSION;
    let (target, mut cursor) =
        if current && valid_target(backend, state.building_collection.as_deref()).await? {
            let target = state.building_collection.clone().expect("validated target");
            (target, state.build_cursor)
        } else {
            let fresh = current
                && state.building_collection.is_none()
                && state
                    .published_at
                    .is_some_and(|at| now - at < refresh_interval())
                && valid_target(backend, state.active_collection.as_deref()).await?;
            if fresh {
                return Ok(PeopleOutcome::Idle);
            }
            // Persist the name before creating it. An abandoned or unknown
            // collection is never deleted here.
            let target = format!("{PEOPLE_PREFIX}{}", Uuid::new_v4().simple());
            source.start_build(&target).await?;
            backend.create_collection(&people_schema(&target)).await?;
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

    if backend.get_alias(PEOPLE_ALIAS).await?.as_deref() != Some(target.as_str()) {
        backend.upsert_alias(PEOPLE_ALIAS, &target).await?;
    }
    let retired = source.publish(&target).await?;
    if let Some(retired) = retired.filter(|name| name != &target && people_owned(name)) {
        // Two generations stay live: active and the one it replaced. The
        // generation before that was superseded a full refresh interval ago.
        if let Err(error) = backend.delete_collection(&retired).await {
            io.log(
                LogLevel::Warn,
                &format!("movie people search: could not delete {retired}: {error:#}"),
            )
            .await;
        }
    }
    io.log(
        LogLevel::Info,
        &format!("movie people search ready in {target}"),
    )
    .await;
    Ok(PeopleOutcome::Published)
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
    async fn publish(&self, target: &str) -> Result<Option<String>> {
        let mut tx = self.pool.begin().await?;
        let row = sqlx::query(
            "SELECT active_collection, previous_collection FROM movie_people_search_state WHERE id=$1 AND building_collection=$2 FOR UPDATE",
        )
        .bind(PEOPLE_ALIAS)
        .bind(target)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| anyhow::anyhow!("movie people build target changed"))?;
        let active: Option<String> = row.try_get("active_collection")?;
        let previous: Option<String> = row.try_get("previous_collection")?;
        // The replaced generation is kept; the one before it is handed back.
        let kept = active.filter(|name| name != target);
        let retired = previous.filter(|name| Some(name) != kept.as_ref() && name != target);
        // The snapshot is as fresh as its start, so the refresh clock uses it.
        sqlx::query("UPDATE movie_people_search_state SET active_collection=$1, previous_collection=$3, building_collection=NULL, build_cursor=NULL, published_at=coalesce(build_started_at, now()), updated_at=now() WHERE id=$2")
            .bind(target).bind(PEOPLE_ALIAS).bind(kept).execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(retired)
    }
}
