//! Typesense collection schemas — port of
//! `apps/api/src/shared/search/collections/index.ts` (`buildAllCollectionSchemas`).
//! Asserted against `fixtures/search/collections.json`, which the API's parity
//! spec checks too.

use serde_json::{Value, json};

use super::mappers::LookupKind;

/// What a collection is filled from, in reindex order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Source {
    Games,
    Lookup(LookupKind),
    Posts,
}

#[derive(Debug, Clone, Copy)]
pub struct CollectionSpec {
    /// Live (alias or collection) name, e.g. `games_en`.
    pub name: &'static str,
    pub source: Source,
}

/// Same order as the API's `buildAllCollectionSchemas()`; the checkpoint's
/// `collectionIndex` indexes into this list, so only append to it.
pub const COLLECTIONS: [CollectionSpec; 7] = [
    CollectionSpec {
        name: "games_en",
        source: Source::Games,
    },
    CollectionSpec {
        name: "developers_en",
        source: Source::Lookup(LookupKind::Developer),
    },
    CollectionSpec {
        name: "publishers_en",
        source: Source::Lookup(LookupKind::Publisher),
    },
    CollectionSpec {
        name: "genres_en",
        source: Source::Lookup(LookupKind::Genre),
    },
    CollectionSpec {
        name: "platforms_en",
        source: Source::Lookup(LookupKind::Platform),
    },
    CollectionSpec {
        name: "themes_en",
        source: Source::Lookup(LookupKind::Theme),
    },
    CollectionSpec {
        name: "posts_en",
        source: Source::Posts,
    },
];

/// Collections of the removed Turkish index, deleted when found.
pub fn legacy_collections() -> Vec<String> {
    COLLECTIONS
        .iter()
        .map(|c| format!("{}_tr", c.name.trim_end_matches("_en")))
        .collect()
}

fn string(name: &str) -> Value {
    json!({ "name": name, "type": "string" })
}
fn opt(name: &str, ty: &str) -> Value {
    json!({ "name": name, "type": ty, "optional": true })
}
fn facet(name: &str) -> Value {
    json!({ "name": name, "type": "string", "facet": true })
}
fn opt_facet(name: &str, ty: &str) -> Value {
    json!({ "name": name, "type": ty, "facet": true, "optional": true })
}
fn int64(name: &str) -> Value {
    json!({ "name": name, "type": "int64" })
}

fn lookup_fields(with_country: bool) -> Vec<Value> {
    let mut fields = vec![string("id"), string("name"), facet("slug")];
    if with_country {
        fields.push(
            json!({ "name": "countryCode", "type": "string", "optional": true, "facet": true }),
        );
    }
    fields.push(int64("createdAt"));
    fields.push(opt("updatedAt", "int64"));
    fields
}

fn fields_for(source: Source) -> (Vec<Value>, &'static str) {
    match source {
        Source::Games => (
            vec![
                string("id"),
                facet("slug"),
                string("title"),
                opt("originalTitle", "string"),
                opt("description", "string"),
                opt("coverImageUrl", "string"),
                json!({ "name": "releaseDate", "type": "string", "optional": true, "facet": true }),
                opt("metacriticScore", "int32"),
                opt("openCriticScore", "int32"),
                opt("criticScore", "int32"),
                opt("criticScoreCount", "int32"),
                json!({ "name": "popularityScore", "type": "float", "optional": true, "sort": true }),
                int64("releaseTimestamp"),
                opt("hltbMainHours", "string"),
                opt("hltbMainExtraHours", "string"),
                opt("hltbCompletionistHours", "string"),
                opt("developerIds", "string[]"),
                opt_facet("developerNames", "string[]"),
                opt("developerSlugs", "string[]"),
                opt("publisherIds", "string[]"),
                opt_facet("publisherNames", "string[]"),
                opt("publisherSlugs", "string[]"),
                opt("genreIds", "string[]"),
                opt_facet("genreNames", "string[]"),
                opt("genreSlugs", "string[]"),
                opt("platformIds", "string[]"),
                opt_facet("platformNames", "string[]"),
                opt("platformSlugs", "string[]"),
                opt("themeIds", "string[]"),
                opt_facet("themeNames", "string[]"),
                opt("themeSlugs", "string[]"),
                int64("createdAt"),
                opt("updatedAt", "int64"),
            ],
            "createdAt",
        ),
        Source::Lookup(kind) => (lookup_fields(kind.has_country_code()), "createdAt"),
        Source::Posts => (
            vec![
                string("id"),
                facet("slug"),
                string("title"),
                opt("excerpt", "string"),
                opt("content", "string"),
                opt("coverImageUrl", "string"),
                opt("seoTitle", "string"),
                opt("seoDescription", "string"),
                opt("authorUsername", "string"),
                opt("authorDisplayName", "string"),
                int64("publishedAt"),
                int64("createdAt"),
                opt("updatedAt", "int64"),
            ],
            "publishedAt",
        ),
    }
}

/// The create-collection body for `spec`, named `name` (the live name or a
/// physical `{name}__{timestamp}` collection).
pub fn schema(spec: &CollectionSpec, name: &str) -> Value {
    let (fields, default_sorting_field) = fields_for(spec.source);
    json!({
        "name": name,
        "fields": fields,
        "default_sorting_field": default_sorting_field,
    })
}

pub fn all_schemas() -> Vec<Value> {
    COLLECTIONS.iter().map(|c| schema(c, c.name)).collect()
}

/// Run suffix shared by all physical collections of one full reindex:
/// `yyyymmddhhmmss` (UTC).
pub fn run_suffix(at: chrono::DateTime<chrono::Utc>) -> String {
    at.format("%Y%m%d%H%M%S").to_string()
}

/// Physical collection behind alias `name` for a run: `{name}__{suffix}`.
pub fn physical_name(name: &str, suffix: &str) -> String {
    format!("{name}__{suffix}")
}

/// True for physical collections created for `name` by a reindex.
pub fn is_physical_of(name: &str, candidate: &str) -> bool {
    candidate
        .strip_prefix(name)
        .and_then(|rest| rest.strip_prefix("__"))
        .is_some_and(|ts| ts.len() == 14 && ts.bytes().all(|b| b.is_ascii_digit()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn physical_names() {
        let at = chrono::Utc.with_ymd_and_hms(2026, 11, 4, 3, 0, 7).unwrap();
        let suffix = run_suffix(at);
        assert_eq!(suffix, "20261104030007");
        let name = physical_name("games_en", &suffix);
        assert_eq!(name, "games_en__20261104030007");
        assert!(is_physical_of("games_en", &name));
        assert!(!is_physical_of("games_en", "games_en"));
        assert!(!is_physical_of("games_en", "games_en__2026"));
        assert!(!is_physical_of("games", "games_en__20261104030007"));
    }

    #[test]
    fn legacy_names() {
        assert_eq!(
            legacy_collections(),
            vec![
                "games_tr",
                "developers_tr",
                "publishers_tr",
                "genres_tr",
                "platforms_tr",
                "themes_tr",
                "posts_tr"
            ]
        );
    }
}
