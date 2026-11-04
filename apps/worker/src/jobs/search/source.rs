//! Source queries for the reindex, keyset-paginated by primary key. They read
//! the same columns the API's repositories return (games with relations
//! ordered by name, all lookups, published posts with their author).

use std::collections::HashMap;

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;

use super::collections::Source;
use super::mappers::{
    GameRow, LookupKind, LookupRow, PostRow, RelationRef, to_game_doc, to_lookup_doc, to_post_doc,
};

/// A page of mapped source rows plus the last primary key (for the checkpoint).
pub struct Page<T> {
    pub rows: Vec<T>,
    pub last_id: Option<Uuid>,
}

fn lookup_table(kind: LookupKind) -> (&'static str, &'static str, &'static str) {
    // (lookup table, join table, join column)
    match kind {
        LookupKind::Developer => ("developers", "game_developers", "developer_id"),
        LookupKind::Publisher => ("publishers", "game_publishers", "publisher_id"),
        LookupKind::Genre => ("genres", "game_genres", "genre_id"),
        LookupKind::Platform => ("platforms", "game_platforms", "platform_id"),
        LookupKind::Theme => ("themes", "game_themes", "theme_id"),
    }
}

/// `(table, base filter)` of the rows a collection is built from.
fn source_table(source: Source) -> (&'static str, &'static str) {
    match source {
        Source::Games => ("games", "true"),
        Source::Lookup(kind) => (lookup_table(kind).0, "true"),
        Source::Posts => ("posts", "status = 'published'"),
    }
}

/// Source rows, optionally only those with `id <= up_to` (resume progress).
pub async fn count(pool: &PgPool, source: Source, up_to: Option<Uuid>) -> sqlx::Result<i64> {
    let (table, filter) = source_table(source);
    sqlx::query_scalar(&format!(
        "SELECT count(*) FROM {table} WHERE {filter} AND ($1::uuid IS NULL OR id <= $1)"
    ))
    .bind(up_to)
    .fetch_one(pool)
    .await
}

/// Keyset page of source ids only (for the sync diff).
pub async fn ids_page(
    pool: &PgPool,
    source: Source,
    after: Option<Uuid>,
    limit: i64,
) -> sqlx::Result<Vec<Uuid>> {
    let (table, filter) = source_table(source);
    sqlx::query_scalar(&format!(
        "SELECT id FROM {table} WHERE {filter} AND ($1::uuid IS NULL OR id > $1) ORDER BY id LIMIT $2"
    ))
    .bind(after)
    .bind(limit)
    .fetch_all(pool)
    .await
}

/// Which rows a page query selects.
#[derive(Debug, Clone, Copy)]
pub enum Select<'a> {
    /// Keyset page: rows with `id > after`, ordered by id.
    After(Option<Uuid>, i64),
    /// Exactly these ids (order by id).
    Ids(&'a [Uuid]),
}

impl Select<'_> {
    /// SQL condition using `$1`/`$2`, given the id column expression.
    fn condition(&self, id: &str) -> String {
        match self {
            Select::After(..) => format!("({id} > $1 OR $1::uuid IS NULL) ORDER BY {id} LIMIT $2"),
            Select::Ids(_) => format!("{id} = ANY($1) ORDER BY {id}"),
        }
    }

    fn bind<'q>(
        &self,
        query: sqlx::query::Query<'q, sqlx::Postgres, sqlx::postgres::PgArguments>,
    ) -> sqlx::query::Query<'q, sqlx::Postgres, sqlx::postgres::PgArguments> {
        match *self {
            Select::After(after, limit) => query.bind(after).bind(limit),
            Select::Ids(ids) => query.bind(ids.to_vec()),
        }
    }
}

pub async fn games_page(pool: &PgPool, select: Select<'_>) -> sqlx::Result<Page<GameRow>> {
    let sql = format!(
        "SELECT id, slug, title, original_title, description, cover_image_url, release_date, \
             metacritic_score, open_critic_score, critic_score, critic_score_count, popularity_score, \
             hltb_main_hours::text AS hltb_main_hours, \
             hltb_main_extra_hours::text AS hltb_main_extra_hours, \
             hltb_completionist_hours::text AS hltb_completionist_hours, \
             created_at, updated_at \
         FROM games WHERE {}",
        select.condition("id")
    );
    let rows = select.bind(sqlx::query(&sql)).fetch_all(pool).await?;

    let ids: Vec<Uuid> = rows.iter().map(|r| r.get("id")).collect();
    let last_id = ids.last().copied();
    let mut relations: [HashMap<Uuid, Vec<RelationRef>>; 5] = Default::default();
    if !ids.is_empty() {
        let kinds = [
            LookupKind::Developer,
            LookupKind::Publisher,
            LookupKind::Genre,
            LookupKind::Platform,
            LookupKind::Theme,
        ];
        for (slot, kind) in kinds.into_iter().enumerate() {
            relations[slot] = relations_for(pool, kind, &ids).await?;
        }
    }

    let mut games = Vec::with_capacity(rows.len());
    for row in rows {
        let id: Uuid = row.try_get("id")?;
        let release_date: Option<NaiveDate> = row.try_get("release_date")?;
        let mut take = |slot: usize| relations[slot].remove(&id).unwrap_or_default();
        games.push(GameRow {
            id: id.to_string(),
            slug: row.try_get("slug")?,
            title: row.try_get("title")?,
            original_title: row.try_get("original_title")?,
            description: row.try_get("description")?,
            cover_image_url: row.try_get("cover_image_url")?,
            release_date: release_date.map(|d| d.format("%Y-%m-%d").to_string()),
            metacritic_score: row.try_get("metacritic_score")?,
            open_critic_score: row.try_get("open_critic_score")?,
            critic_score: row.try_get("critic_score")?,
            critic_score_count: row.try_get("critic_score_count")?,
            popularity_score: row.try_get("popularity_score")?,
            hltb_main_hours: row.try_get("hltb_main_hours")?,
            hltb_main_extra_hours: row.try_get("hltb_main_extra_hours")?,
            hltb_completionist_hours: row.try_get("hltb_completionist_hours")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            developers: take(0),
            publishers: take(1),
            genres: take(2),
            platforms: take(3),
            themes: take(4),
        });
    }
    Ok(Page {
        rows: games,
        last_id,
    })
}

/// Relations of the given games, ordered by name like the API's
/// `attachRelations` (with `id` as a deterministic tiebreaker).
async fn relations_for(
    pool: &PgPool,
    kind: LookupKind,
    game_ids: &[Uuid],
) -> sqlx::Result<HashMap<Uuid, Vec<RelationRef>>> {
    let (table, join, column) = lookup_table(kind);
    let sql = format!(
        "SELECT j.game_id, l.id, l.name, l.slug FROM {join} j \
         INNER JOIN {table} l ON j.{column} = l.id \
         WHERE j.game_id = ANY($1) ORDER BY l.name, l.id"
    );
    let rows = sqlx::query(&sql).bind(game_ids).fetch_all(pool).await?;
    let mut map: HashMap<Uuid, Vec<RelationRef>> = HashMap::new();
    for row in rows {
        let game_id: Uuid = row.try_get("game_id")?;
        let id: Uuid = row.try_get("id")?;
        map.entry(game_id).or_default().push(RelationRef {
            id: id.to_string(),
            name: row.try_get("name")?,
            slug: row.try_get("slug")?,
        });
    }
    Ok(map)
}

pub async fn lookups_page(
    pool: &PgPool,
    kind: LookupKind,
    select: Select<'_>,
) -> sqlx::Result<Page<LookupRow>> {
    let (table, _, _) = lookup_table(kind);
    let country = if kind.has_country_code() {
        "country_code::text AS country_code"
    } else {
        "NULL::text AS country_code"
    };
    let sql = format!(
        "SELECT id, name, slug, {country}, created_at, updated_at FROM {table} WHERE {}",
        select.condition("id")
    );
    let rows = select.bind(sqlx::query(&sql)).fetch_all(pool).await?;
    let mut last_id = None;
    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let id: Uuid = row.try_get("id")?;
        last_id = Some(id);
        out.push(LookupRow {
            id: id.to_string(),
            name: row.try_get("name")?,
            slug: row.try_get("slug")?,
            country_code: row.try_get("country_code")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        });
    }
    Ok(Page { rows: out, last_id })
}

pub async fn posts_page(pool: &PgPool, select: Select<'_>) -> sqlx::Result<Page<PostRow>> {
    let sql = format!(
        "SELECT p.id, p.slug, p.title, p.excerpt, p.content, p.cover_image_url, p.seo_title, \
             p.seo_description, p.published_at, p.created_at, p.updated_at, \
             u.username AS author_username, u.display_name AS author_display_name \
         FROM posts p LEFT JOIN users u ON p.author_id = u.id \
         WHERE p.status = 'published' AND {}",
        select.condition("p.id")
    );
    let rows = select.bind(sqlx::query(&sql)).fetch_all(pool).await?;
    let mut last_id = None;
    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let id: Uuid = row.try_get("id")?;
        last_id = Some(id);
        let published_at: Option<DateTime<Utc>> = row.try_get("published_at")?;
        let updated_at: Option<DateTime<Utc>> = row.try_get("updated_at")?;
        out.push(PostRow {
            id: id.to_string(),
            slug: row.try_get("slug")?,
            title: row.try_get("title")?,
            excerpt: row.try_get("excerpt")?,
            content: row.try_get("content")?,
            cover_image_url: row.try_get("cover_image_url")?,
            seo_title: row.try_get("seo_title")?,
            seo_description: row.try_get("seo_description")?,
            author_username: row.try_get("author_username")?,
            author_display_name: row.try_get("author_display_name")?,
            published_at,
            created_at: row.try_get("created_at")?,
            updated_at,
        });
    }
    Ok(Page { rows: out, last_id })
}

/// Mapped search documents of one page plus the last primary key.
pub struct DocPage {
    pub docs: Vec<Value>,
    pub last_id: Option<Uuid>,
}

/// Source data for the search jobs, as a trait so job logic can be tested
/// without a database.
#[async_trait]
pub trait SourceData: Send + Sync {
    /// Row count; with `up_to`, only rows with `id <= up_to`.
    async fn count(&self, source: Source, up_to: Option<Uuid>) -> Result<u64>;
    /// Keyset page of mapped documents (`id > after`, ordered by id).
    async fn docs_page(&self, source: Source, after: Option<Uuid>, limit: usize)
    -> Result<DocPage>;
    /// Keyset page of ids only.
    async fn ids_page(
        &self,
        source: Source,
        after: Option<Uuid>,
        limit: usize,
    ) -> Result<Vec<Uuid>>;
    /// Mapped documents for exactly these ids (missing ones are skipped).
    async fn docs_by_ids(&self, source: Source, ids: &[Uuid]) -> Result<Vec<Value>>;
}

pub struct PgSource {
    pub pool: PgPool,
}

async fn load(pool: &PgPool, source: Source, select: Select<'_>) -> Result<DocPage> {
    let to_value = |v: serde_json::Result<Value>| v.map_err(anyhow::Error::from);
    Ok(match source {
        Source::Games => {
            let page = games_page(pool, select).await?;
            DocPage {
                docs: page
                    .rows
                    .iter()
                    .map(|r| to_value(serde_json::to_value(to_game_doc(r))))
                    .collect::<Result<_>>()?,
                last_id: page.last_id,
            }
        }
        Source::Lookup(kind) => {
            let page = lookups_page(pool, kind, select).await?;
            DocPage {
                docs: page
                    .rows
                    .iter()
                    .map(|r| to_value(serde_json::to_value(to_lookup_doc(kind, r))))
                    .collect::<Result<_>>()?,
                last_id: page.last_id,
            }
        }
        Source::Posts => {
            let page = posts_page(pool, select).await?;
            DocPage {
                docs: page
                    .rows
                    .iter()
                    .map(|r| to_value(serde_json::to_value(to_post_doc(r))))
                    .collect::<Result<_>>()?,
                last_id: page.last_id,
            }
        }
    })
}

#[async_trait]
impl SourceData for PgSource {
    async fn count(&self, source: Source, up_to: Option<Uuid>) -> Result<u64> {
        Ok(count(&self.pool, source, up_to).await?.max(0) as u64)
    }

    async fn docs_page(
        &self,
        source: Source,
        after: Option<Uuid>,
        limit: usize,
    ) -> Result<DocPage> {
        load(&self.pool, source, Select::After(after, limit as i64)).await
    }

    async fn ids_page(
        &self,
        source: Source,
        after: Option<Uuid>,
        limit: usize,
    ) -> Result<Vec<Uuid>> {
        Ok(ids_page(&self.pool, source, after, limit as i64).await?)
    }

    async fn docs_by_ids(&self, source: Source, ids: &[Uuid]) -> Result<Vec<Value>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        Ok(load(&self.pool, source, Select::Ids(ids)).await?.docs)
    }
}
