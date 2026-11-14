use super::people::*;
use super::*;
use std::collections::BTreeMap;
use std::sync::Mutex;

use super::super::search::fake::FakeMeili;
use chrono::DateTime;

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
    publishes: usize,
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
    async fn publish(&self, build: &str) -> Result<()> {
        let mut m = self.model.lock().unwrap();
        anyhow::ensure!(m.state.building_collection.as_deref() == Some(build));
        m.state.active_collection = Some(PEOPLE_ALIAS.into());
        m.state.building_collection = None;
        m.state.build_cursor = None;
        m.state.published_at = Some(now());
        m.publishes += 1;
        Ok(())
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
            publishes: 0,
        }),
    }
}
fn limits(documents: usize) -> Limits {
    Limits {
        documents,
        duration: Duration::from_secs(60),
    }
}
fn builds(backend: &FakeMeili) -> Vec<String> {
    backend
        .names()
        .into_iter()
        .filter(|name| name.contains("__build_"))
        .collect()
}

#[test]
fn people_build_names_are_owned() {
    assert!(people_owned("movie_people_en__build_ABC1"));
    assert!(!people_owned("movie_people_en__build_"));
    assert!(!people_owned("movie_people_en__build_x/evil"));
    assert!(!people_owned("movie_people_en__v1_abc"));
    assert!(!people_owned("movies_en__build_abc"));
    assert_eq!(
        people_settings()["rankingRules"],
        json!([
            "words",
            "typo",
            "proximity",
            "attribute",
            "exactness",
            "publicCreditCount:desc",
            "nameSort:asc"
        ])
    );
}

#[tokio::test]
async fn first_build_indexes_only_searchable_people_and_publishes_the_stable_uid() {
    let (source, backend) = (source(2500), FakeMeili::default());
    let outcome = run_people(&Io::default(), &backend, &source, limits(100_000), now())
        .await
        .unwrap();
    assert_eq!(outcome, PeopleOutcome::Published);
    let state = source.model.lock().unwrap().state.clone();
    assert_eq!(state.active_collection.as_deref(), Some(PEOPLE_ALIAS));
    assert!(state.building_collection.is_none());
    assert_eq!(backend.doc_count(PEOPLE_ALIAS), 2500 - 2500 / 3);
    assert!(
        backend
            .doc(PEOPLE_ALIAS, &Uuid::from_u128(3).to_string())
            .is_none()
    );
    assert_eq!(
        backend.state.lock().unwrap().indexes[PEOPLE_ALIAS].settings,
        people_settings()
    );
    assert!(builds(&backend).is_empty());
}

#[tokio::test]
async fn bounded_build_resumes_from_the_durable_cursor_without_touching_the_live_index() {
    let (source, backend) = (source(2500), FakeMeili::default());
    run_people(&Io::default(), &backend, &source, limits(100_000), now())
        .await
        .unwrap();
    // A person changes; the live snapshot keeps the old name until the swap.
    source.model.lock().unwrap().people.insert(
        Uuid::from_u128(1),
        Some(document(Uuid::from_u128(1), "Renamed", 2)),
    );
    let later = now() + refresh_interval() + ChronoDuration::minutes(1);
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(1000), later)
            .await
            .unwrap(),
        PeopleOutcome::Remaining
    );
    {
        let m = source.model.lock().unwrap();
        assert_eq!(m.state.active_collection.as_deref(), Some(PEOPLE_ALIAS));
        assert_eq!(m.state.build_cursor, Some(Uuid::from_u128(1000)));
        assert_eq!(
            backend
                .doc(PEOPLE_ALIAS, &Uuid::from_u128(1).to_string())
                .unwrap()["name"],
            "Person 1"
        );
    }
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(100_000), later)
            .await
            .unwrap(),
        PeopleOutcome::Published
    );
    let m = source.model.lock().unwrap();
    assert_eq!(m.starts, 2, "the resumed run continues the same generation");
    assert_eq!(
        backend
            .doc(PEOPLE_ALIAS, &Uuid::from_u128(1).to_string())
            .unwrap()["name"],
        "Renamed"
    );
    assert_eq!(backend.doc_count(PEOPLE_ALIAS), 2500 - 2500 / 3);
    assert!(
        builds(&backend).is_empty(),
        "the swapped-out snapshot is deleted"
    );
}

#[tokio::test]
async fn a_fresh_snapshot_is_left_alone_and_a_stale_one_is_rebuilt() {
    let (source, backend) = (source(10), FakeMeili::default());
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
async fn outdated_settings_or_typesense_state_start_a_new_generation() {
    // Typesense-era state: old version and collection names.
    let (source, backend) = (source(10), FakeMeili::default());
    {
        let mut m = source.model.lock().unwrap();
        m.state.schema_version = 1;
        m.state.active_collection = Some("movie_people_en__v1_gone".into());
        m.state.published_at = Some(now());
    }
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(100_000), now())
            .await
            .unwrap(),
        PeopleOutcome::Published
    );
    assert_eq!(
        source.model.lock().unwrap().state.schema_version,
        PEOPLE_SCHEMA_VERSION
    );

    // A fresh snapshot whose live settings differ is rebuilt immediately.
    backend
        .state
        .lock()
        .unwrap()
        .indexes
        .get_mut(PEOPLE_ALIAS)
        .unwrap()
        .settings = json!({ "searchableAttributes": ["name"] });
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(100_000), now())
            .await
            .unwrap(),
        PeopleOutcome::Published
    );
    assert_eq!(source.model.lock().unwrap().starts, 2);
    assert_eq!(
        backend.state.lock().unwrap().indexes[PEOPLE_ALIAS].settings,
        people_settings()
    );
}

#[tokio::test]
async fn a_build_with_outdated_settings_is_abandoned_and_deleted() {
    let (source, backend) = (
        source(10),
        FakeMeili::with(&[
            ("movie_people_en__build_old", 3, json!({})),
            ("unrelated", 1, json!({})),
        ]),
    );
    source.model.lock().unwrap().state.building_collection =
        Some("movie_people_en__build_old".into());
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(100_000), now())
            .await
            .unwrap(),
        PeopleOutcome::Published
    );
    assert!(!backend.exists("movie_people_en__build_old"));
    assert!(backend.exists("unrelated"));
    assert_eq!(source.model.lock().unwrap().starts, 1);
}

#[tokio::test]
async fn a_crash_between_swap_and_publish_only_publishes() {
    let (source, backend) = (source(10), FakeMeili::default());
    run_people(&Io::default(), &backend, &source, limits(100_000), now())
        .await
        .unwrap();
    backend.state.lock().unwrap().crash_after_swap = true;
    let later = now() + refresh_interval();
    assert!(
        run_people(&Io::default(), &backend, &source, limits(100_000), later)
            .await
            .is_err()
    );
    let swaps = backend.state.lock().unwrap().swaps.len();
    assert_eq!(source.model.lock().unwrap().publishes, 1);
    assert_eq!(
        run_people(&Io::default(), &backend, &source, limits(100_000), later)
            .await
            .unwrap(),
        PeopleOutcome::Published
    );
    assert_eq!(
        backend.state.lock().unwrap().swaps.len(),
        swaps,
        "no second swap"
    );
    let m = source.model.lock().unwrap();
    assert_eq!(m.publishes, 2);
    assert_eq!(m.starts, 2);
    assert!(builds(&backend).is_empty());
    assert_eq!(backend.doc_count(PEOPLE_ALIAS), 7);
}

#[tokio::test]
async fn failed_import_never_advances_the_cursor_or_publishes() {
    let (source, backend) = (source(10), FakeMeili::default());
    backend.state.lock().unwrap().fail_next_add = true;
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
    let (source, backend) = (source(10), FakeMeili::default());
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
    assert!(backend.names().is_empty());
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
