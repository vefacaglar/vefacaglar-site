//! Port of the API's search document mappers
//! (`apps/api/src/shared/search/mappers/{game,lookup,post}.mapper.ts`).
//! Field names, optionality and conversions must stay identical; the golden
//! fixtures in `apps/worker/fixtures/search/` are asserted by both sides.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize, Serializer};

use super::strip_mdx::strip_mdx;

/// `releaseTimestamp` of a game without a release date: earlier than any real one.
pub const RELEASE_UNKNOWN: i64 = -9_999_999_999;
/// `popularityScore` of a game without one: below any real (0-1) score.
pub const POPULARITY_UNKNOWN: f64 = -1.0;

// --- Source rows (shape of what the API's repositories return) ---

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationRef {
    pub id: String,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameRow {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub original_title: Option<String>,
    pub description: Option<String>,
    pub cover_image_url: Option<String>,
    /// Postgres `date` as `YYYY-MM-DD` (Drizzle's default string mode).
    pub release_date: Option<String>,
    pub metacritic_score: Option<i32>,
    pub open_critic_score: Option<i32>,
    pub critic_score: Option<i32>,
    pub critic_score_count: Option<i32>,
    pub popularity_score: Option<f64>,
    /// Postgres `numeric(6,1)` as text, e.g. `"12.5"`.
    pub hltb_main_hours: Option<String>,
    pub hltb_main_extra_hours: Option<String>,
    pub hltb_completionist_hours: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub developers: Vec<RelationRef>,
    #[serde(default)]
    pub publishers: Vec<RelationRef>,
    #[serde(default)]
    pub genres: Vec<RelationRef>,
    #[serde(default)]
    pub platforms: Vec<RelationRef>,
    #[serde(default)]
    pub themes: Vec<RelationRef>,
}

/// Developers, publishers, genres, platforms and themes share this shape;
/// only developers and publishers have `countryCode`.
#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupRow {
    pub id: String,
    pub name: String,
    pub slug: String,
    #[serde(default)]
    pub country_code: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostRow {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub excerpt: Option<String>,
    pub content: Option<String>,
    pub cover_image_url: Option<String>,
    pub seo_title: Option<String>,
    pub seo_description: Option<String>,
    pub author_username: Option<String>,
    pub author_display_name: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
}

// --- Documents ---

/// Serializes integral floats as JSON integers, like `JSON.stringify`
/// (`-1`, not `-1.0`), and non-finite values as `null`.
fn js_number<S: Serializer>(value: &f64, serializer: S) -> Result<S::Ok, S::Error> {
    if !value.is_finite() {
        serializer.serialize_unit()
    } else if value.fract() == 0.0 && value.abs() < 9_007_199_254_740_992.0 {
        serializer.serialize_i64(*value as i64)
    } else {
        serializer.serialize_f64(*value)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameDoc {
    pub id: String,
    pub slug: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub release_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metacritic_score: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_critic_score: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub critic_score: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub critic_score_count: Option<i32>,
    #[serde(serialize_with = "js_number")]
    pub popularity_score: f64,
    pub release_timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hltb_main_hours: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hltb_main_extra_hours: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hltb_completionist_hours: Option<String>,
    pub developer_ids: Vec<String>,
    pub developer_names: Vec<String>,
    pub developer_slugs: Vec<String>,
    pub publisher_ids: Vec<String>,
    pub publisher_names: Vec<String>,
    pub publisher_slugs: Vec<String>,
    pub genre_ids: Vec<String>,
    pub genre_names: Vec<String>,
    pub genre_slugs: Vec<String>,
    pub platform_ids: Vec<String>,
    pub platform_names: Vec<String>,
    pub platform_slugs: Vec<String>,
    pub theme_ids: Vec<String>,
    pub theme_names: Vec<String>,
    pub theme_slugs: Vec<String>,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<i64>,
}

/// One document type for all lookups; `countryCode` is only ever set for
/// developers and publishers (see [`LookupKind::has_country_code`]).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LookupDoc {
    pub id: String,
    pub name: String,
    pub slug: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country_code: Option<String>,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostDoc {
    pub id: String,
    pub slug: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub excerpt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seo_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seo_description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author_display_name: Option<String>,
    pub published_at: i64,
    pub created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LookupKind {
    Developer,
    Publisher,
    Genre,
    Platform,
    Theme,
}

impl LookupKind {
    pub fn has_country_code(self) -> bool {
        matches!(self, Self::Developer | Self::Publisher)
    }
}

// --- Mapping ---

/// `Math.floor(date.getTime() / 1000)`; chrono's `timestamp()` floors too.
fn unix_seconds(value: &DateTime<Utc>) -> i64 {
    value.timestamp()
}

/// `new Date("YYYY-MM-DD")` parses as UTC midnight.
fn release_timestamp(release_date: Option<&str>) -> i64 {
    match release_date {
        Some(raw) if !raw.is_empty() => NaiveDate::parse_from_str(raw, "%Y-%m-%d")
            .ok()
            .and_then(|d| d.and_hms_opt(0, 0, 0))
            .map(|dt| dt.and_utc().timestamp())
            .unwrap_or(RELEASE_UNKNOWN),
        _ => RELEASE_UNKNOWN,
    }
}

fn split(relations: &[RelationRef]) -> (Vec<String>, Vec<String>, Vec<String>) {
    (
        relations.iter().map(|r| r.id.clone()).collect(),
        relations.iter().map(|r| r.name.clone()).collect(),
        relations.iter().map(|r| r.slug.clone()).collect(),
    )
}

pub fn to_game_doc(game: &GameRow) -> GameDoc {
    let (developer_ids, developer_names, developer_slugs) = split(&game.developers);
    let (publisher_ids, publisher_names, publisher_slugs) = split(&game.publishers);
    let (genre_ids, genre_names, genre_slugs) = split(&game.genres);
    let (platform_ids, platform_names, platform_slugs) = split(&game.platforms);
    let (theme_ids, theme_names, theme_slugs) = split(&game.themes);
    GameDoc {
        id: game.id.clone(),
        slug: game.slug.clone(),
        title: game.title.clone(),
        original_title: game.original_title.clone(),
        description: game.description.clone(),
        cover_image_url: game.cover_image_url.clone(),
        release_date: game.release_date.clone(),
        metacritic_score: game.metacritic_score,
        open_critic_score: game.open_critic_score,
        critic_score: game.critic_score,
        critic_score_count: game.critic_score_count,
        popularity_score: game.popularity_score.unwrap_or(POPULARITY_UNKNOWN),
        release_timestamp: release_timestamp(game.release_date.as_deref()),
        hltb_main_hours: game.hltb_main_hours.clone(),
        hltb_main_extra_hours: game.hltb_main_extra_hours.clone(),
        hltb_completionist_hours: game.hltb_completionist_hours.clone(),
        developer_ids,
        developer_names,
        developer_slugs,
        publisher_ids,
        publisher_names,
        publisher_slugs,
        genre_ids,
        genre_names,
        genre_slugs,
        platform_ids,
        platform_names,
        platform_slugs,
        theme_ids,
        theme_names,
        theme_slugs,
        created_at: unix_seconds(&game.created_at),
        updated_at: game.updated_at.as_ref().map(unix_seconds),
    }
}

pub fn to_lookup_doc(kind: LookupKind, row: &LookupRow) -> LookupDoc {
    LookupDoc {
        id: row.id.clone(),
        name: row.name.clone(),
        slug: row.slug.clone(),
        country_code: if kind.has_country_code() {
            row.country_code.clone()
        } else {
            None
        },
        created_at: unix_seconds(&row.created_at),
        updated_at: row.updated_at.as_ref().map(unix_seconds),
    }
}

pub fn to_post_doc(post: &PostRow) -> PostDoc {
    let content = strip_mdx(post.content.as_deref().unwrap_or(""));
    PostDoc {
        id: post.id.clone(),
        slug: post.slug.clone(),
        title: post.title.clone(),
        excerpt: post.excerpt.clone(),
        content: (!content.is_empty()).then_some(content),
        cover_image_url: post.cover_image_url.clone(),
        seo_title: post.seo_title.clone(),
        seo_description: post.seo_description.clone(),
        author_username: post.author_username.clone(),
        author_display_name: post.author_display_name.clone(),
        published_at: post.published_at.as_ref().map(unix_seconds).unwrap_or(0),
        created_at: unix_seconds(&post.created_at),
        updated_at: post.updated_at.as_ref().map(unix_seconds),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn popularity_serializes_like_javascript() {
        #[derive(Serialize)]
        struct W {
            #[serde(serialize_with = "js_number")]
            v: f64,
        }
        let s = |v: f64| serde_json::to_string(&W { v }).unwrap();
        assert_eq!(s(-1.0), r#"{"v":-1}"#);
        assert_eq!(s(1.0), r#"{"v":1}"#);
        assert_eq!(s(0.25), r#"{"v":0.25}"#);
        assert_eq!(s(f64::NAN), r#"{"v":null}"#);
    }

    #[test]
    fn release_timestamp_is_utc_midnight() {
        assert_eq!(release_timestamp(Some("1970-01-02")), 86_400);
        assert_eq!(release_timestamp(Some("1969-12-31")), -86_400);
        assert_eq!(release_timestamp(None), RELEASE_UNKNOWN);
        assert_eq!(release_timestamp(Some("")), RELEASE_UNKNOWN);
    }
}
