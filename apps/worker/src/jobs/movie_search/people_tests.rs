use super::people::*;
use super::*;
use std::collections::{BTreeMap, HashSet};
use std::sync::Mutex;

use super::super::search::backend::ImportFailure;

#[derive(Default)]
struct Io {
    stop: bool,
}
#[async_trait]
impl JobIo for Io {
    fn should_stop(&self) -> bool {
        self.stop
    }
    fn is_cancel_requested(&self) -> bool {
        self.stop
    }
    async fn log(&self, _: LogLevel, _: &str) {}
    async fn progress(&self, _: &Progress) -> Result<()> {
        Ok(())
    }
    async fn checkpoint(&self, _: &Progress, _: Value) -> Result<()> {
        Ok(())
    }
}

struct Model {
    state: PeopleState,
    /// Person ID -> document when searchable.
    people: BTreeMap<Uuid, Option<Value>>,
    starts: usize,
    previous_collection: Option<String>,
}
struct Source {
    model: Mutex<Model>,
}
#[async_trait]
impl PeopleSource for Source {
    async fn state(&self) -> Result<PeopleState> {
        Ok(self.model.lock().unwrap().state.clone())
    }
    async fn start_build(&self, target: &str) -> Result<()> {
        let mut m = self.model.lock().unwrap();
        m.starts += 1;
        m.state.schema_version = PEOPLE_SCHEMA_VERSION;
        m.state.building_collection = Some(target.into());
        m.state.build_cursor = None;
        Ok(())
    }
    async fn scan(&self, after: Option<Uuid>, limit: usize) -> Result<PeopleBatch> {
        let m = self.model.lock().unwrap();
        let selected: Vec<_> = m
            .people
            .iter()
            .filter(|(id, _)| after.is_none_or(|after| **id > after))
            .take(limit)
            .collect();
        Ok(PeopleBatch {
            docs: selected
                .iter()
                .filter_map(|(_, doc)| (*doc).clone())
                .collect(),
            last_id: selected.last().map(|(id, _)| **id),
            selected: selected.len(),
        })
    }
    async fn advance(&self, target: &str, cursor: Uuid) -> Result<()> {
        let mut m = self.model.lock().unwrap();
        anyhow::ensure!(m.state.building_collection.as_deref() == Some(target));
        m.state.build_cursor = Some(cursor);
        Ok(())
    }
    async fn publish(&self, target: &str) -> Result<Option<String>> {
        let mut m = self.model.lock().unwrap();
        anyhow::ensure!(m.state.building_collection.as_deref() == Some(target));
        let kept = m
            .state
            .active_collection
            .replace(target.into())
            .filter(|name| name != target);
        let retired = std::mem::replace(&mut m.previous_collection, kept.clone())
            .filter(|name| Some(name) != kept.as_ref() && name != target);
        m.state.building_collection = None;
        m.state.build_cursor = None;
        m.state.published_at = Some(now());
        Ok(retired)
    }
}

#[derive(Default)]
struct Engine {
    schemas: BTreeMap<String, Value>,
    docs: BTreeMap<String, BTreeMap<String, Value>>,
    alias: Option<String>,
    fail_import: bool,
    deleted: Vec<String>,
}
#[derive(Default)]
struct Backend {
    engine: Mutex<Engine>,
}
#[async_trait]
impl SearchBackend for Backend {
    async fn get_alias(&self, _: &str) -> Result<Option<String>> {
        Ok(self.engine.lock().unwrap().alias.clone())
    }
    async fn collection_exists(&self, name: &str) -> Result<bool> {
        Ok(self.engine.lock().unwrap().schemas.contains_key(name))
    }
    async fn list_collections(&self) -> Result<Vec<String>> {
        Ok(self
            .engine
            .lock()
            .unwrap()
            .schemas
            .keys()
            .cloned()
            .collect())
    }
    async fn collection_schema(&self, name: &str) -> Result<Option<Value>> {
        Ok(self.engine.lock().unwrap().schemas.get(name).cloned())
    }
    async fn create_collection(&self, schema: &Value) -> Result<()> {
        let name = schema["name"].as_str().unwrap().to_owned();
        self.engine
            .lock()
            .unwrap()
            .schemas
            .insert(name, schema.clone());
        Ok(())
    }
    async fn delete_collection(&self, name: &str) -> Result<bool> {
        let mut e = self.engine.lock().unwrap();
        e.deleted.push(name.into());
        e.docs.remove(name);
        Ok(e.schemas.remove(name).is_some())
    }
    async fn upsert_alias(&self, _: &str, target: &str) -> Result<()> {
        self.engine.lock().unwrap().alias = Some(target.into());
        Ok(())
    }
    async fn import(&self, target: &str, docs: &[Value]) -> Result<Vec<ImportFailure>> {
        let mut e = self.engine.lock().unwrap();
        if e.fail_import {
            e.fail_import = false;
            return Ok(vec![ImportFailure {
                id: docs[0]["id"].as_str().map(str::to_owned),
                error: "invalid document".into(),
            }]);
        }
        for doc in docs {
            e.docs
                .entry(target.into())
                .or_default()
                .insert(doc["id"].as_str().unwrap().into(), doc.clone());
        }
        Ok(vec![])
    }
    async fn export_ids(&self, _: &str) -> Result<HashSet<String>> {
        panic!("people sync never exports IDs")
    }
}

fn now() -> DateTime<Utc> {
    "2026-11-14T12:00:00Z".parse().unwrap()
}
fn document(id: Uuid, name: &str, credits: i32) -> Value {
    json!({"id": id.to_string(), "name": name, "publicCreditCount": credits,
        "nameSort": name.to_lowercase()})
}
/// Every third person has no public credit or name and is never indexed.
fn source(count: u128) -> Source {
    let people = (1..=count)
        .map(|index| {
            let id = Uuid::from_u128(index);
            let doc = (index % 3 != 0).then(|| document(id, &format!("Person {index}"), 1));
            (id, doc)
        })
        .collect();
    Source {
        model: Mutex::new(Model {
            state: PeopleState {
                schema_version: PEOPLE_SCHEMA_VERSION,
                active_collection: None,
                building_collection: None,
                build_cursor: None,
                published_at: None,
            },
            people,
            starts: 0,
            previous_collection: None,
        }),
    }
}
fn limits(documents: usize) -> Limits {
    Limits {
        documents,
        duration: Duration::from_secs(60),
    }
}
use chrono::DateTime;

#[test]
fn people_schema_is_exactly_the_api_contract() {
    let expected: Value = serde_json::from_str(include_str!(
        "../../../../api/src/modules/movies/search/movie-people-search.schema.json"
    ))
    .unwrap();
    assert_eq!(people_schema(PEOPLE_ALIAS), expected);
    let target = "movie_people_en__v1_abc";
    assert!(compatible_with(
        &people_schema(target),
        &people_schema(target)
    ));
    let mut changed = people_schema(target);
    changed["fields"][2]["sort"] = json!(false);
    assert!(!compatible_with(&changed, &people_schema(target)));
    assert!(people_owned("movie_people_en__v1_ABC_1"));
    assert!(!people_owned("movie_people_en__v1_"));
    assert!(!people_owned("movie_people_en__v1_x/evil"));
    assert!(!people_owned("movies_en__v2_abc"));
}

#[tokio::test]
async fn first_build_indexes_only_searchable_people_and_publishes() {
    let (source, backend) = (source(2500), Backend::default());
    let outcome = run_people(&Io::default(), &backend, &source, limits(100_000), now())
        .await
        .unwrap();
    assert_eq!(outcome, PeopleOutcome::Published);
    let state = source.model.lock().unwrap().state.clone();
    let active = state.active_collection.unwrap();
    assert!(people_owned(&active));
    assert!(state.building_collection.is_none());
    let e = backend.engine.lock().unwrap();
    assert_eq!(e.alias.as_deref(), Some(active.as_str()));
    let docs = &e.docs[&active];
    assert_eq!(docs.len(), 2500 - 2500 / 3);
    assert!(!docs.contains_key(&Uuid::from_u128(3).to_string()));
}

#[tokio::test]
async fn bounded_build_resumes_from_the_durable_cursor_without_touching_the_active_snapshot() {
    let (source, backend) = (source(2500), Backend::default());
    run_people(&Io::default(), &backend, &source, limits(100_000), now())
        .await
        .unwrap();
    let old = source
        .model
        .lock()
        .unwrap()
        .state
        .active_collection
        .clone()
        .unwrap();
    let later = now() + refresh_interval() + ChronoDuration::minutes(1);
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(1000), later)
            .await
            .unwrap(),
        PeopleOutcome::Remaining
    );
    {
        let m = source.model.lock().unwrap();
        assert_eq!(m.state.active_collection.as_deref(), Some(old.as_str()));
        assert_eq!(m.state.build_cursor, Some(Uuid::from_u128(1000)));
        assert_eq!(
            backend.engine.lock().unwrap().alias.as_deref(),
            Some(old.as_str())
        );
    }
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(100_000), later)
            .await
            .unwrap(),
        PeopleOutcome::Published
    );
    let second = {
        let m = source.model.lock().unwrap();
        assert_eq!(m.starts, 2, "the resumed run continues the same generation");
        let active = m.state.active_collection.clone().unwrap();
        assert_ne!(active, old);
        assert_eq!(m.previous_collection.as_deref(), Some(old.as_str()));
        let e = backend.engine.lock().unwrap();
        assert!(
            e.deleted.is_empty(),
            "the replaced generation stays for readers that just resolved it"
        );
        assert!(e.schemas.contains_key(&old));
        assert_eq!(e.docs[&active].len(), 2500 - 2500 / 3);
        active
    };
    let third_run = later + refresh_interval();
    assert_eq!(
        run_people(
            &Io::default(),
            &backend,
            &source,
            limits(100_000),
            third_run
        )
        .await
        .unwrap(),
        PeopleOutcome::Published
    );
    let m = source.model.lock().unwrap();
    assert_eq!(m.previous_collection.as_deref(), Some(second.as_str()));
    let e = backend.engine.lock().unwrap();
    assert_eq!(
        e.deleted,
        vec![old],
        "only the generation before the replaced one is removed"
    );
    assert!(e.schemas.contains_key(&second));
}

#[tokio::test]
async fn a_fresh_snapshot_is_left_alone_and_a_stale_one_is_rebuilt() {
    let (source, backend) = (source(10), Backend::default());
    run_people(&Io::default(), &backend, &source, limits(100_000), now())
        .await
        .unwrap();
    let soon = now() + ChronoDuration::hours(1);
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(100_000), soon)
            .await
            .unwrap(),
        PeopleOutcome::Idle
    );
    assert_eq!(source.model.lock().unwrap().starts, 1);
    let late = now() + refresh_interval();
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(100_000), late)
            .await
            .unwrap(),
        PeopleOutcome::Published
    );
    assert_eq!(source.model.lock().unwrap().starts, 2);
}

#[tokio::test]
async fn missing_or_incompatible_collections_start_a_new_generation_without_deleting_unknown_ones()
{
    let (source, backend) = (source(10), Backend::default());
    {
        let mut m = source.model.lock().unwrap();
        m.state.active_collection = Some("movie_people_en__v1_gone".into());
        m.state.published_at = Some(now());
        m.state.building_collection = Some("movie_people_en__v1_broken".into());
        let mut wrong = people_schema("movie_people_en__v1_broken");
        wrong["fields"][1]["type"] = json!("string");
        backend
            .engine
            .lock()
            .unwrap()
            .schemas
            .insert("movie_people_en__v1_broken".into(), wrong);
    }
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(100_000), now())
            .await
            .unwrap(),
        PeopleOutcome::Published
    );
    let e = backend.engine.lock().unwrap();
    assert!(e.schemas.contains_key("movie_people_en__v1_broken"));
    assert!(e.deleted.is_empty());
    assert_eq!(
        source.model.lock().unwrap().previous_collection.as_deref(),
        Some("movie_people_en__v1_gone")
    );
}

#[tokio::test]
async fn failed_import_never_advances_the_cursor_or_publishes() {
    let (source, backend) = (source(10), Backend::default());
    backend.engine.lock().unwrap().fail_import = true;
    assert!(
        run_people(&Io::default(), &backend, &source, limits(100_000), now())
            .await
            .is_err()
    );
    {
        let m = source.model.lock().unwrap();
        assert!(m.state.active_collection.is_none());
        assert!(m.state.build_cursor.is_none());
    }
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(100_000), now())
            .await
            .unwrap(),
        PeopleOutcome::Published
    );
    assert_eq!(
        source.model.lock().unwrap().starts,
        1,
        "retry reuses the building generation"
    );
}

#[tokio::test]
async fn cancellation_stops_before_any_work() {
    let (source, backend) = (source(10), Backend::default());
    assert_eq!(
        run_people(
            &Io { stop: true },
            &backend,
            &source,
            limits(100_000),
            now()
        )
        .await
        .unwrap(),
        PeopleOutcome::Interrupted
    );
    assert_eq!(source.model.lock().unwrap().starts, 0);
}

#[tokio::test]
async fn unowned_retired_generations_are_never_deleted() {
    let (source, backend) = (source(10), Backend::default());
    {
        let mut m = source.model.lock().unwrap();
        m.state.active_collection = Some("movie_people_en__v1_old".into());
        m.previous_collection = Some("movies_en__v2_live".into());
    }
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(100_000), now())
            .await
            .unwrap(),
        PeopleOutcome::Published
    );
    assert!(backend.engine.lock().unwrap().deleted.is_empty());
}

#[test]
fn people_progress_extends_a_completed_movie_run_but_never_masks_interruption() {
    assert_eq!(
        combine(JobOutcome::Completed, PeopleOutcome::Idle),
        JobOutcome::Completed
    );
    assert_eq!(
        combine(JobOutcome::Completed, PeopleOutcome::Published),
        JobOutcome::Completed
    );
    assert!(matches!(
        combine(JobOutcome::Completed, PeopleOutcome::Remaining),
        JobOutcome::CompletedWithContinuation { .. }
    ));
    assert_eq!(
        combine(JobOutcome::Interrupted, PeopleOutcome::Published),
        JobOutcome::Interrupted
    );
    assert_eq!(
        combine(JobOutcome::Completed, PeopleOutcome::Interrupted),
        JobOutcome::Interrupted
    );
    let continuation = JobOutcome::CompletedWithContinuation { run_at: now() };
    assert_eq!(
        combine(continuation, PeopleOutcome::Remaining),
        continuation
    );
}
