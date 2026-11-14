//! The games-family Meilisearch indexes owned by `search.reindex` and
//! `search.sync`, and the naming of their temporary build indexes.

use serde_json::Value;

use super::mappers::LookupKind;
use super::settings;

/// What an index is filled from, in reindex order.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Source {
    Games,
    Lookup(LookupKind),
    Posts,
}

#[derive(Debug, Clone, Copy)]
pub struct IndexSpec {
    /// Stable index uid the API queries, e.g. `games_en`.
    pub name: &'static str,
    pub source: Source,
    /// Versioned settings file (`meili/<name>.json`).
    pub settings: &'static str,
}

impl IndexSpec {
    /// Parsed [`IndexSpec::settings`].
    pub fn settings(&self) -> Value {
        settings::parse(self.settings)
    }
}

/// The checkpoint's `collectionIndex` indexes into this list, so only append.
pub const INDEXES: [IndexSpec; 7] = [
    IndexSpec {
        name: "games_en",
        source: Source::Games,
        settings: include_str!("meili/games_en.json"),
    },
    IndexSpec {
        name: "developers_en",
        source: Source::Lookup(LookupKind::Developer),
        settings: include_str!("meili/developers_en.json"),
    },
    IndexSpec {
        name: "publishers_en",
        source: Source::Lookup(LookupKind::Publisher),
        settings: include_str!("meili/publishers_en.json"),
    },
    IndexSpec {
        name: "genres_en",
        source: Source::Lookup(LookupKind::Genre),
        settings: include_str!("meili/genres_en.json"),
    },
    IndexSpec {
        name: "platforms_en",
        source: Source::Lookup(LookupKind::Platform),
        settings: include_str!("meili/platforms_en.json"),
    },
    IndexSpec {
        name: "themes_en",
        source: Source::Lookup(LookupKind::Theme),
        settings: include_str!("meili/themes_en.json"),
    },
    IndexSpec {
        name: "posts_en",
        source: Source::Posts,
        settings: include_str!("meili/posts_en.json"),
    },
];

/// Run suffix shared by all build indexes of one full reindex:
/// `yyyymmddhhmmss` (UTC).
pub fn run_suffix(at: chrono::DateTime<chrono::Utc>) -> String {
    at.format("%Y%m%d%H%M%S").to_string()
}

/// Temporary index a run loads before swapping it in: `{name}__build_{suffix}`.
pub fn build_name(name: &str, suffix: &str) -> String {
    format!("{name}__build_{suffix}")
}

/// True for build indexes created for `name` by a reindex.
pub fn is_build_of(name: &str, candidate: &str) -> bool {
    candidate
        .strip_prefix(name)
        .and_then(|rest| rest.strip_prefix("__build_"))
        .is_some_and(|ts| ts.len() == 14 && ts.bytes().all(|b| b.is_ascii_digit()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn build_names() {
        let at = chrono::Utc.with_ymd_and_hms(2026, 11, 4, 3, 0, 7).unwrap();
        let suffix = run_suffix(at);
        assert_eq!(suffix, "20261104030007");
        let name = build_name("games_en", &suffix);
        assert_eq!(name, "games_en__build_20261104030007");
        assert!(is_build_of("games_en", &name));
        assert!(!is_build_of("games_en", "games_en"));
        assert!(!is_build_of("games_en", "games_en__20261104030007"));
        assert!(!is_build_of("games_en", "games_en__build_2026"));
        assert!(!is_build_of("games", "games_en__build_20261104030007"));
    }

    #[test]
    fn every_index_has_settings() {
        for spec in INDEXES {
            assert!(spec.settings().is_object(), "{}", spec.name);
        }
    }
}
