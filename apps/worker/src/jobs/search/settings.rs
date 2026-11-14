//! Versioned Meilisearch index settings, one JSON file per stable index uid
//! under `meili/`, embedded by their owners (`IndexSpec::settings`, the movie
//! and people jobs). The jobs compare these with the live settings: any
//! difference (or a missing index) triggers a rebuild into a fresh index, so
//! editing a file is enough to roll out new settings.

use serde_json::Value;

/// Parses an embedded settings file. The files are compiled in and checked by
/// the tests below, so a parse failure is a programming error.
pub fn parse(raw: &str) -> Value {
    serde_json::from_str(raw).expect("valid Meilisearch settings JSON")
}

#[cfg(test)]
mod tests {
    use super::super::indexes::INDEXES;
    use crate::jobs::movie_search::{index_settings, people::people_settings};

    #[test]
    fn every_settings_file_is_a_valid_object() {
        let all = INDEXES
            .iter()
            .map(|spec| (spec.name, spec.settings()))
            .chain([
                ("movies_en", index_settings()),
                ("movie_people_en", people_settings()),
            ]);
        for (uid, settings) in all {
            assert!(settings.is_object(), "{uid}");
            assert!(
                settings["searchableAttributes"].is_array(),
                "{uid} must list searchable attributes"
            );
            assert!(
                settings["pagination"]["maxTotalHits"].as_u64().unwrap() >= 100_000,
                "{uid} must allow exact deep pagination"
            );
        }
    }

    #[test]
    fn movie_ranking_puts_sort_after_relevance() {
        // Typed queries rank by relevance first; placeholder browse is a pure
        // sort because the relevance rules are no-ops without query words.
        // No attributeRank (title and originalTitle weigh equally) and no
        // exactness (an exact whole-title match earns no automatic boost).
        let rules = index_settings()["rankingRules"].clone();
        assert_eq!(
            rules,
            serde_json::json!(["words", "typo", "proximity", "wordPosition", "sort"])
        );
    }
}
