//! Golden-fixture parity with the API's TypeScript mappers and collection
//! schemas. The expected output in `fixtures/search/` is generated from the TS
//! code (see `apps/api/src/shared/search/mappers/mappers.parity.spec.ts`).

use std::path::PathBuf;

use serde::Deserialize;
use serde_json::Value;
use worker::jobs::search::collections::all_schemas;
use worker::jobs::search::mappers::{
    GameRow, LookupKind, LookupRow, PostRow, to_game_doc, to_lookup_doc, to_post_doc,
};

#[derive(Deserialize)]
struct Case {
    name: String,
    #[serde(default)]
    kind: Option<LookupKind>,
    input: Value,
    expected: Value,
}

#[derive(Deserialize)]
struct Fixtures {
    games: Vec<Case>,
    lookups: Vec<Case>,
    posts: Vec<Case>,
}

fn fixture(name: &str) -> String {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("fixtures/search")
        .join(name);
    std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()))
}

fn fixtures() -> Fixtures {
    serde_json::from_str(&fixture("mappers.json")).expect("valid mappers.json")
}

fn assert_case(case: &Case, actual: Value) {
    assert!(
        !case.expected.is_null(),
        "{}: fixture has no expected output",
        case.name
    );
    assert_eq!(
        actual, case.expected,
        "{}:\n actual:   {actual}\n expected: {}",
        case.name, case.expected
    );
}

#[test]
fn game_documents_match_typescript() {
    let fixtures = fixtures();
    assert!(!fixtures.games.is_empty());
    for case in &fixtures.games {
        let row: GameRow = serde_json::from_value(case.input.clone()).expect("game input");
        assert_case(case, serde_json::to_value(to_game_doc(&row)).unwrap());
    }
}

#[test]
fn lookup_documents_match_typescript() {
    let fixtures = fixtures();
    assert!(!fixtures.lookups.is_empty());
    for case in &fixtures.lookups {
        let row: LookupRow = serde_json::from_value(case.input.clone()).expect("lookup input");
        let kind = case.kind.expect("lookup kind");
        assert_case(
            case,
            serde_json::to_value(to_lookup_doc(kind, &row)).unwrap(),
        );
    }
}

#[test]
fn post_documents_match_typescript() {
    let fixtures = fixtures();
    assert!(!fixtures.posts.is_empty());
    for case in &fixtures.posts {
        let row: PostRow = serde_json::from_value(case.input.clone()).expect("post input");
        assert_case(case, serde_json::to_value(to_post_doc(&row)).unwrap());
    }
}

#[test]
fn game_jsonl_serialization_matches_javascript_numbers() {
    // Integral floats must serialize like JSON.stringify (`-1`, not `-1.0`).
    let fixtures = fixtures();
    let minimal = fixtures
        .games
        .iter()
        .find(|c| c.name.starts_with("minimal"))
        .unwrap();
    let row: GameRow = serde_json::from_value(minimal.input.clone()).unwrap();
    let line = serde_json::to_string(&to_game_doc(&row)).unwrap();
    assert!(line.contains("\"popularityScore\":-1,"), "{line}");
}

#[test]
fn collection_schemas_match_typescript() {
    let expected: Value =
        serde_json::from_str(&fixture("collections.json")).expect("valid collections.json");
    assert_eq!(Value::Array(all_schemas()), expected);
}
