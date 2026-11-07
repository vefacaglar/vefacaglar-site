//! PostgreSQL source/ledger operations. All Typesense I/O happens after these
//! statements/short transactions finish. Publication locks state before any
//! ledger operation, matching the ranking producer's lock order.
use anyhow::{Result, ensure};
use async_trait::async_trait;
use chrono::NaiveDate;
use serde_json::Value;
use sqlx::{PgPool, Postgres, Row, Transaction};
use uuid::Uuid;

use super::{ALIAS, SCHEMA_VERSION};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct State {
    pub schema_version: i32,
    pub active_collection: Option<String>,
    pub building_collection: Option<String>,
    #[sqlx(rename = "bootstrap_phase")]
    pub phase: String,
    #[sqlx(rename = "bootstrap_cursor")]
    pub cursor: Option<Uuid>,
}
impl State {
    pub fn target(&self) -> Option<&str> {
        self.building_collection
            .as_deref()
            .or(self.active_collection.as_deref())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Publication {
    pub generation: i64,
    pub source_date: Option<NaiveDate>,
}
#[derive(Debug, Clone)]
pub struct Document {
    pub id: Uuid,
    pub revision: i64,
    /// None is a durable tombstone (missing or nonpublic canonical source).
    pub document: Option<Value>,
}
pub struct Batch {
    pub rows: Vec<Document>,
    pub last_id: Option<Uuid>,
    pub publication: Publication,
}

#[async_trait]
pub trait MovieSource: Send + Sync {
    async fn state(&self) -> Result<State>;
    async fn start_build(&self, target: &str) -> Result<()>;
    async fn scan(&self, after: Option<Uuid>, limit: usize) -> Result<Batch>;
    async fn dirty(&self, target: &str, replay: bool, limit: usize) -> Result<Batch>;
    async fn ack(&self, target: &str, rows: &[Document]) -> Result<()>;
    async fn advance_scan(&self, target: &str, cursor: Option<Uuid>, done: bool) -> Result<()>;
    async fn can_publish(&self, target: &str, publication: Publication) -> Result<bool>;
    async fn publish(&self, target: &str, publication: Publication) -> Result<bool>;
    async fn repair_due(&self) -> Result<bool>;
    /// Advances the durable daily reconciliation cursor, returning examined rows.
    async fn repair(&self, limit: usize) -> Result<usize>;
    async fn remaining(&self, target: &str) -> Result<bool>;
}

pub struct PgMovieSource {
    pub pool: PgPool,
}

const STATE_COLUMNS: &str =
    "schema_version, active_collection, building_collection, bootstrap_phase, bootstrap_cursor";
const PUBLIC: &str = "m.is_film = true AND m.hydrated_at IS NOT NULL AND m.title IS NOT NULL";
// This entire projection runs in one statement snapshot. Never capture a source
// document before reading its ledger revision, or mix an old score with a new
// ranking generation. Lowercase is computed by PostgreSQL's own collation.
const CAPTURE: &str = r#"
, snapshot AS (
    SELECT ranking_generation,
      (SELECT source_date FROM movie_popularity_state WHERE id='enwiki-top-articles-v1') AS source_date
    FROM movie_search_state WHERE id='movies_en'
), documents AS (
    SELECT l.movie_id, l.requested_revision,
      CASE WHEN m.is_film=true AND m.hydrated_at IS NOT NULL AND m.title IS NOT NULL THEN
        jsonb_strip_nulls(jsonb_build_object(
          'id', l.movie_id::text, 'title', m.title, 'originalTitle', m.original_title,
          'personQids', ARRAY(SELECT DISTINCT p.wikidata_id::text
            FROM movie_credits c JOIN movie_people p ON p.id=c.person_id
            WHERE c.movie_id=m.id AND c.rank <> 'deprecated' ORDER BY p.wikidata_id::text),
          'interestScore', CASE WHEN m.wikipedia_source_date=s.source_date
            THEN coalesce(m.wikipedia_views,-1) ELSE -1 END,
          'titleSort', lower(m.title), 'tieBreakId', l.movie_id::text))
      END AS document
    FROM candidates c JOIN movie_search_sync l ON l.movie_id=c.movie_id
    LEFT JOIN movies m ON m.id=l.movie_id CROSS JOIN snapshot s
)
SELECT d.movie_id, d.requested_revision, d.document, s.ranking_generation, s.source_date
FROM snapshot s LEFT JOIN documents d ON true ORDER BY d.movie_id
"#;

fn decode_batch(rows: Vec<sqlx::postgres::PgRow>) -> Result<Batch> {
    let first = rows
        .first()
        .ok_or_else(|| anyhow::anyhow!("movie publication state missing"))?;
    let publication = Publication {
        generation: first.try_get("ranking_generation")?,
        source_date: first.try_get("source_date")?,
    };
    let mut documents = Vec::new();
    for row in rows {
        if let Some(id) = row.try_get::<Option<Uuid>, _>("movie_id")? {
            documents.push(Document {
                id,
                revision: row.try_get("requested_revision")?,
                document: row.try_get("document")?,
            });
        }
    }
    Ok(Batch {
        last_id: documents.last().map(|row| row.id),
        rows: documents,
        publication,
    })
}

/// The caller already holds the singleton state lock. The ledger read is
/// nonlocking and uses no ledger->state inversion against rank publishers.
async fn publishable(
    tx: &mut Transaction<'_, Postgres>,
    target: &str,
    publication: Publication,
) -> Result<bool> {
    let valid: bool = sqlx::query_scalar(r#"
      SELECT schema_version=$2 AND bootstrap_phase IN ('replay','ready')
        AND coalesce(building_collection,active_collection)=$1
        AND ranking_generation=$3
        AND (SELECT source_date FROM movie_popularity_state WHERE id='enwiki-top-articles-v1') IS NOT DISTINCT FROM $4::date
        AND NOT EXISTS (SELECT 1 FROM movie_search_sync
          WHERE requested_revision>applied_revision OR (s.building_collection IS NOT NULL AND indexed_collection IS DISTINCT FROM $1))
      FROM movie_search_state s WHERE id='movies_en'
    "#).bind(target).bind(SCHEMA_VERSION).bind(publication.generation).bind(publication.source_date)
        .fetch_one(&mut **tx).await?;
    Ok(valid)
}

#[async_trait]
impl MovieSource for PgMovieSource {
    async fn state(&self) -> Result<State> {
        sqlx::query("INSERT INTO movie_search_state (id) VALUES ($1) ON CONFLICT DO NOTHING")
            .bind(ALIAS)
            .execute(&self.pool)
            .await?;
        Ok(sqlx::query_as(&format!(
            "SELECT {STATE_COLUMNS} FROM movie_search_state WHERE id=$1"
        ))
        .bind(ALIAS)
        .fetch_one(&self.pool)
        .await?)
    }
    async fn start_build(&self, target: &str) -> Result<()> {
        sqlx::query("UPDATE movie_search_state SET schema_version=$2, building_collection=$1, bootstrap_phase='scan', bootstrap_cursor=NULL, ranking_ready=false, updated_at=now() WHERE id='movies_en'")
            .bind(target).bind(SCHEMA_VERSION).execute(&self.pool).await?;
        Ok(())
    }
    async fn scan(&self, after: Option<Uuid>, limit: usize) -> Result<Batch> {
        // Retain the exact selected UUIDs, even if visibility changes between
        // seeding and capture. Newly inserted ledger rows are committed before
        // the canonical snapshot; no source locks survive a network request.
        let ids: Vec<Uuid> = sqlx::query_scalar(&format!(
            r#"
          WITH ids AS MATERIALIZED (SELECT m.id FROM movies m WHERE {PUBLIC}
            AND ($1::uuid IS NULL OR m.id>$1) ORDER BY m.id LIMIT $2),
          seeded AS (INSERT INTO movie_search_sync (movie_id) SELECT id FROM ids
            ON CONFLICT DO NOTHING RETURNING movie_id)
          SELECT id FROM ids ORDER BY id
        "#
        ))
        .bind(after)
        .bind(limit as i64)
        .fetch_all(&self.pool)
        .await?;
        let mut batch = decode_batch(
            sqlx::query(&format!(
                "WITH candidates AS (SELECT unnest($1::uuid[]) AS movie_id) {CAPTURE}"
            ))
            .bind(&ids)
            .fetch_all(&self.pool)
            .await?,
        )?;
        // Cursor refers to selection, never to whichever documents stayed public.
        batch.last_id = ids.last().copied();
        ensure!(
            batch.rows.len() == ids.len(),
            "movie ledger rows disappeared during scan"
        );
        Ok(batch)
    }
    async fn dirty(&self, target: &str, replay: bool, limit: usize) -> Result<Batch> {
        // Separate SQL keeps normal operation on the partial pending index.
        let predicate = if replay {
            "requested_revision>applied_revision OR indexed_collection IS DISTINCT FROM $1"
        } else {
            "requested_revision>applied_revision AND $1::text IS NOT NULL"
        };
        let query = format!(
            "WITH candidates AS MATERIALIZED (SELECT movie_id FROM movie_search_sync WHERE {predicate} ORDER BY movie_id LIMIT $2) {CAPTURE}"
        );
        decode_batch(
            sqlx::query(&query)
                .bind(target)
                .bind(limit as i64)
                .fetch_all(&self.pool)
                .await?,
        )
    }
    async fn ack(&self, target: &str, rows: &[Document]) -> Result<()> {
        if rows.is_empty() {
            return Ok(());
        }
        let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
        let revisions: Vec<i64> = rows.iter().map(|row| row.revision).collect();
        sqlx::query(
            r#"UPDATE movie_search_sync l
          SET applied_revision=greatest(l.applied_revision,c.revision), indexed_collection=$3
          FROM unnest($1::uuid[], $2::bigint[]) c(id,revision) WHERE l.movie_id=c.id"#,
        )
        .bind(ids)
        .bind(revisions)
        .bind(target)
        .execute(&self.pool)
        .await?;
        Ok(())
    }
    async fn advance_scan(&self, target: &str, cursor: Option<Uuid>, done: bool) -> Result<()> {
        let result = sqlx::query("UPDATE movie_search_state SET bootstrap_cursor=coalesce($2,bootstrap_cursor), bootstrap_phase=CASE WHEN $3 THEN 'replay' ELSE 'scan' END, updated_at=now() WHERE id='movies_en' AND building_collection=$1")
            .bind(target).bind(cursor).bind(done).execute(&self.pool).await?;
        ensure!(
            result.rows_affected() == 1,
            "movie bootstrap target changed"
        );
        Ok(())
    }
    async fn can_publish(&self, target: &str, publication: Publication) -> Result<bool> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT id FROM movie_search_state WHERE id='movies_en' FOR UPDATE")
            .fetch_one(&mut *tx)
            .await?;
        let valid = publishable(&mut tx, target, publication).await?;
        tx.commit().await?;
        Ok(valid)
    }
    async fn publish(&self, target: &str, publication: Publication) -> Result<bool> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("SELECT id FROM movie_search_state WHERE id='movies_en' FOR UPDATE")
            .fetch_one(&mut *tx)
            .await?;
        if !publishable(&mut tx, target, publication).await? {
            tx.rollback().await?;
            return Ok(false);
        }
        sqlx::query("UPDATE movie_search_state SET active_collection=$1, building_collection=NULL, bootstrap_phase='ready', ranking_ready=true, published_source_date=$2, updated_at=now() WHERE id='movies_en'")
            .bind(target).bind(publication.source_date).execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(true)
    }
    async fn repair_due(&self) -> Result<bool> {
        Ok(sqlx::query_scalar("SELECT repair_completed_at IS NULL OR repair_completed_at < now()-interval '1 day' FROM movie_search_state WHERE id='movies_en'")
            .fetch_one(&self.pool).await?)
    }
    async fn repair(&self, limit: usize) -> Result<usize> {
        let mut tx = self.pool.begin().await?;
        let cursor: Option<Uuid> = sqlx::query_scalar(
            "SELECT repair_cursor FROM movie_search_state WHERE id='movies_en' FOR UPDATE",
        )
        .fetch_one(&mut *tx)
        .await?;
        let rows = sqlx::query(&format!("SELECT l.movie_id, NOT coalesce(({PUBLIC}),false) AS tombstone FROM movie_search_sync l LEFT JOIN movies m ON m.id=l.movie_id WHERE ($1::uuid IS NULL OR l.movie_id>$1) ORDER BY l.movie_id LIMIT $2"))
            .bind(cursor).bind(limit as i64).fetch_all(&mut *tx).await?;
        let ids: Vec<Uuid> = rows.iter().map(|row| row.get("movie_id")).collect();
        let tombstones: Vec<Uuid> = rows
            .iter()
            .filter(|row| row.get::<bool, _>("tombstone"))
            .map(|row| row.get("movie_id"))
            .collect();
        if !tombstones.is_empty() {
            sqlx::query("UPDATE movie_search_sync SET requested_revision=requested_revision+1,dirty_at=now() WHERE movie_id=ANY($1::uuid[])")
                .bind(tombstones).execute(&mut *tx).await?;
        }
        let done = ids.len() < limit;
        sqlx::query("UPDATE movie_search_state SET repair_cursor=$1, repair_completed_at=CASE WHEN $2 THEN now() ELSE repair_completed_at END,updated_at=now() WHERE id='movies_en'")
            .bind(if done { None } else { ids.last().copied() }).bind(done).execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(ids.len())
    }
    async fn remaining(&self, target: &str) -> Result<bool> {
        Ok(sqlx::query_scalar(
            r#"SELECT bootstrap_phase<>'ready' OR NOT ranking_ready
          OR repair_completed_at IS NULL OR repair_completed_at<now()-interval '1 day'
          OR EXISTS (SELECT 1 FROM movie_search_sync WHERE requested_revision>applied_revision
             OR (building_collection IS NOT NULL AND indexed_collection IS DISTINCT FROM $1))
          FROM movie_search_state WHERE id='movies_en'"#,
        )
        .bind(target)
        .fetch_one(&self.pool)
        .await?)
    }
}
