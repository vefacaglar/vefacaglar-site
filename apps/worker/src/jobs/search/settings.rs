//! Versioned Meilisearch index settings, one JSON file per stable index uid
//! under `meili/`. The jobs compare these with the live settings: any
//! difference (or a missing index) triggers a rebuild into a fresh index, so
//! editing a file here is enough to roll out new settings.

use serde_json::Value;

const GAMES: &str = include_str!("meili/games_en.json");
const DEVELOPERS: &str = include_str!("meili/developers_en.json");
const PUBLISHERS: &str = include_str!("meili/publishers_en.json");
const GENRES: &str = include_str!("meili/genres_en.json");
const PLATFORMS: &str = include_str!("meili/platforms_en.json");
const THEMES: &str = include_str!("meili/themes_en.json");
const POSTS: &str = include_str!("meili/posts_en.json");
const MOVIES: &str = include_str!("meili/movies_en.json");
const MOVIE_PEOPLE: &str = include_str!("meili/movie_people_en.json");

/// Every stable index uid with its settings file.
pub const ALL: [(&str, &str); 9] = [
    ("games_en", GAMES),
    ("developers_en", DEVELOPERS),
    ("publishers_en", PUBLISHERS),
    ("genres_en", GENRES),
    ("platforms_en", PLATFORMS),
    ("themes_en", THEMES),
    ("posts_en", POSTS),
    ("movies_en", MOVIES),
    ("movie_people_en", MOVIE_PEOPLE),
];

/// Settings for a stable index uid. Panics on an unknown uid (a programming
/// error caught by the tests).
pub fn for_index(uid: &str) -> Value {
    let raw = ALL
        .iter()
        .find(|(name, _)| *name == uid)
        .map(|(_, raw)| *raw)
        .unwrap_or_else(|| panic!("no Meilisearch settings for {uid}"));
    serde_json::from_str(raw).expect("valid Meilisearch settings JSON")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_settings_file_is_a_valid_object() {
        for (uid, _) in ALL {
            let settings = for_index(uid);
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
        let rules = for_index("movies_en")["rankingRules"].clone();
        assert_eq!(
            rules,
            serde_json::json!(["words", "typo", "proximity", "wordPosition", "sort"])
        );
    }
}
