use super::*;
use std::collections::{BTreeMap, HashSet};
use std::sync::Mutex;

use super::super::search::backend::ImportFailure;
use source::Document;

#[derive(Default)]
struct Io {
    checkpoints: Mutex<Vec<Value>>,
    stop_after: Option<usize>,
}
#[async_trait]
impl JobIo for Io {
    fn should_stop(&self) -> bool {
        self.stop_after
            .is_some_and(|count| self.checkpoints.lock().unwrap().len() >= count)
    }
    fn is_cancel_requested(&self) -> bool {
        self.should_stop()
    }
    async fn log(&self, _: LogLevel, _: &str) {}
    async fn progress(&self, _: &Progress) -> Result<()> {
        Ok(())
    }
    async fn checkpoint(&self, _: &Progress, checkpoint: Value) -> Result<()> {
        self.checkpoints.lock().unwrap().push(checkpoint);
        Ok(())
    }
}
#[derive(Clone)]
struct Row {
    document: Option<Value>,
    requested: i64,
    applied: i64,
    target: Option<String>,
}
struct Model {
    state: State,
    rows: BTreeMap<Uuid, Row>,
    publication: Publication,
    published_date: Option<chrono::NaiveDate>,
    ready: bool,
    repair_due: bool,
    repair_cursor: Option<Uuid>,
    scans: Vec<Option<Uuid>>,
    acknowledgements: Vec<(Uuid, i64)>,
    publications: usize,
    visibility_race: bool,
    fail_cursor_once: bool,
}
impl Model {
    fn new(count: usize) -> Self {
        let rows = (1..=count)
            .map(|index| {
                let id = Uuid::from_u128(index as u128);
                (
                    id,
                    Row {
                        document: Some(
                            json!({"id":id,"title":format!("Film {index}"),"interestScore":-1}),
                        ),
                        requested: 1,
                        applied: 0,
                        target: None,
                    },
                )
            })
            .collect();
        Self {
            state: State {
                schema_version: 1,
                active_collection: None,
                building_collection: None,
                phase: "scan".into(),
                cursor: None,
            },
            rows,
            publication: Publication {
                generation: 0,
                source_date: None,
            },
            published_date: None,
            ready: false,
            repair_due: false,
            repair_cursor: None,
            scans: vec![],
            acknowledgements: vec![],
            publications: 0,
            visibility_race: false,
            fail_cursor_once: false,
        }
    }
    fn batch(&self, ids: Vec<Uuid>) -> Batch {
        Batch {
            last_id: ids.last().copied(),
            rows: ids
                .iter()
                .map(|id| {
                    let row = &self.rows[id];
                    Document {
                        id: *id,
                        revision: row.requested,
                        document: row.document.clone(),
                    }
                })
                .collect(),
            publication: self.publication,
        }
    }
    fn pending(&self, target: &str) -> bool {
        self.rows.values().any(|row| {
            row.requested > row.applied
                || (self.state.building_collection.is_some()
                    && row.target.as_deref() != Some(target))
        })
    }
    fn valid(&self, target: &str, publication: Publication) -> bool {
        self.state.target() == Some(target)
            && self.state.phase != "scan"
            && self.publication == publication
            && !self.pending(target)
    }
    fn change_ranking(&mut self) {
        self.publication.generation += 1;
        self.publication.source_date = Some(chrono::NaiveDate::from_ymd_opt(2026, 11, 6).unwrap());
        self.ready = false;
        for row in self.rows.values_mut() {
            row.requested += 1;
            if let Some(document) = row.document.as_mut() {
                document["interestScore"] = json!(42);
            }
        }
    }
}
struct FakeSource {
    model: Arc<Mutex<Model>>,
}
#[async_trait]
impl MovieSource for FakeSource {
    async fn state(&self) -> Result<State> {
        Ok(self.model.lock().unwrap().state.clone())
    }
    async fn start_build(&self, target: &str) -> Result<()> {
        let mut m = self.model.lock().unwrap();
        m.state.schema_version = 1;
        m.state.building_collection = Some(target.into());
        m.state.phase = "scan".into();
        m.state.cursor = None;
        m.ready = false;
        Ok(())
    }
    async fn scan(&self, after: Option<Uuid>, limit: usize) -> Result<Batch> {
        let mut m = self.model.lock().unwrap();
        m.scans.push(after);
        let ids: Vec<Uuid> = m
            .rows
            .iter()
            .filter(|(id, row)| after.is_none_or(|after| **id > after) && row.document.is_some())
            .map(|(id, _)| *id)
            .take(limit)
            .collect();
        if m.visibility_race {
            m.visibility_race = false;
            if let Some(id) = ids.last() {
                let row = m.rows.get_mut(id).unwrap();
                row.document = None;
                row.requested += 1;
            }
        }
        Ok(m.batch(ids))
    }
    async fn dirty(&self, target: &str, replay: bool, limit: usize) -> Result<Batch> {
        let m = self.model.lock().unwrap();
        let ids = m
            .rows
            .iter()
            .filter(|(_, row)| {
                row.requested > row.applied || (replay && row.target.as_deref() != Some(target))
            })
            .map(|(id, _)| *id)
            .take(limit)
            .collect();
        Ok(m.batch(ids))
    }
    async fn ack(&self, target: &str, rows: &[Document]) -> Result<()> {
        let mut m = self.model.lock().unwrap();
        for document in rows {
            let row = m.rows.get_mut(&document.id).unwrap();
            row.applied = row.applied.max(document.revision);
            row.target = Some(target.into());
            m.acknowledgements.push((document.id, document.revision));
        }
        Ok(())
    }
    async fn advance_scan(&self, target: &str, cursor: Option<Uuid>, done: bool) -> Result<()> {
        let mut m = self.model.lock().unwrap();
        assert_eq!(m.state.target(), Some(target));
        if m.fail_cursor_once {
            m.fail_cursor_once = false;
            bail!("simulated crash after ACK before cursor commit");
        }
        m.state.cursor = cursor.or(m.state.cursor);
        m.state.phase = if done { "replay" } else { "scan" }.into();
        Ok(())
    }
    async fn can_publish(&self, target: &str, publication: Publication) -> Result<bool> {
        Ok(self.model.lock().unwrap().valid(target, publication))
    }
    async fn publish(&self, target: &str, publication: Publication) -> Result<bool> {
        let mut m = self.model.lock().unwrap();
        if !m.valid(target, publication) {
            return Ok(false);
        }
        m.state.active_collection = Some(target.into());
        m.state.building_collection = None;
        m.state.phase = "ready".into();
        m.ready = true;
        m.published_date = publication.source_date;
        m.publications += 1;
        Ok(true)
    }
    async fn repair_due(&self) -> Result<bool> {
        Ok(self.model.lock().unwrap().repair_due)
    }
    async fn repair(&self, limit: usize) -> Result<usize> {
        let mut m = self.model.lock().unwrap();
        let ids: Vec<Uuid> = m
            .rows
            .keys()
            .filter(|id| m.repair_cursor.is_none_or(|cursor| **id > cursor))
            .copied()
            .take(limit)
            .collect();
        for id in &ids {
            let row = m.rows.get_mut(id).unwrap();
            if row.document.is_none() {
                row.requested += 1;
            }
        }
        if ids.len() < limit {
            m.repair_due = false;
            m.repair_cursor = None;
        } else {
            m.repair_cursor = ids.last().copied();
        }
        Ok(ids.len())
    }
    async fn remaining(&self, target: &str) -> Result<bool> {
        let m = self.model.lock().unwrap();
        Ok(m.state.phase != "ready" || !m.ready || m.pending(target) || m.repair_due)
    }
}
#[derive(Default)]
struct Engine {
    schemas: BTreeMap<String, Value>,
    docs: BTreeMap<String, BTreeMap<String, Value>>,
    alias: Option<String>,
    fail_import: bool,
    crash_alias: bool,
    revision_race: bool,
    generation_race: bool,
    alias_generation_race: bool,
    imports: usize,
    deletions: usize,
    deleted_collections: Vec<String>,
}
struct Backend {
    engine: Mutex<Engine>,
    model: Arc<Mutex<Model>>,
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
        let mut e = self.engine.lock().unwrap();
        let name = schema["name"].as_str().unwrap().to_owned();
        e.schemas.insert(name.clone(), schema.clone());
        e.docs.entry(name).or_default();
        Ok(())
    }
    async fn delete_collection(&self, name: &str) -> Result<bool> {
        let mut e = self.engine.lock().unwrap();
        e.deleted_collections.push(name.into());
        Ok(e.schemas.remove(name).is_some())
    }
    async fn upsert_alias(&self, _: &str, target: &str) -> Result<()> {
        let mut e = self.engine.lock().unwrap();
        e.alias = Some(target.into());
        if e.alias_generation_race {
            e.alias_generation_race = false;
            self.model.lock().unwrap().change_ranking();
        }
        if e.crash_alias {
            e.crash_alias = false;
            bail!("simulated crash after alias write");
        }
        Ok(())
    }
    async fn import(&self, target: &str, docs: &[Value]) -> Result<Vec<ImportFailure>> {
        let mut e = self.engine.lock().unwrap();
        if docs.is_empty() {
            return Ok(vec![]);
        }
        e.imports += 1;
        for doc in docs {
            e.docs
                .entry(target.into())
                .or_default()
                .insert(doc["id"].as_str().unwrap().into(), doc.clone());
        }
        if e.revision_race {
            e.revision_race = false;
            let mut m = self.model.lock().unwrap();
            let row = m.rows.values_mut().next().unwrap();
            row.requested += 1;
            row.document.as_mut().unwrap()["title"] = json!("Changed concurrently");
        }
        if e.generation_race {
            e.generation_race = false;
            self.model.lock().unwrap().change_ranking();
        }
        if e.fail_import {
            e.fail_import = false;
            return Ok(vec![ImportFailure {
                id: Some(docs[0]["id"].as_str().unwrap().into()),
                error: "invalid document".into(),
            }]);
        }
        Ok(vec![])
    }
    async fn delete_document(&self, target: &str, id: &str) -> Result<()> {
        let mut e = self.engine.lock().unwrap();
        e.deletions += 1;
        e.docs.entry(target.into()).or_default().remove(id);
        Ok(())
    }
    async fn export_ids(&self, _: &str) -> Result<HashSet<String>> {
        panic!("movie sync must never export all IDs")
    }
}
fn setup(count: usize) -> (FakeSource, Backend) {
    let model = Arc::new(Mutex::new(Model::new(count)));
    (
        FakeSource {
            model: model.clone(),
        },
        Backend {
            model,
            engine: Mutex::new(Engine::default()),
        },
    )
}
fn limits(documents: usize) -> Limits {
    Limits {
        documents,
        duration: Duration::from_secs(60),
    }
}
fn ready(source: &FakeSource, backend: &Backend) {
    let target = "movies_en__v1_existing";
    let mut m = source.model.lock().unwrap();
    m.state.active_collection = Some(target.into());
    m.state.phase = "ready".into();
    m.ready = true;
    let mut e = backend.engine.lock().unwrap();
    e.schemas.insert(target.into(), schema(target));
    e.alias = Some(target.into());
    for (id, row) in &mut m.rows {
        row.applied = row.requested;
        row.target = Some(target.into());
        if let Some(doc) = &row.document {
            e.docs
                .entry(target.into())
                .or_default()
                .insert(id.to_string(), doc.clone());
        }
    }
}

#[test]
fn movie_schema_is_exactly_the_api_contract() {
    let expected: Value = serde_json::from_str(include_str!(
        "../../../../api/src/modules/movies/search/movie-search.schema.json"
    ))
    .unwrap();
    assert_eq!(schema(ALIAS), expected);
    assert!(compatible(
        &schema("movies_en__v1_test"),
        "movies_en__v1_test"
    ));
    let mut actual = schema("movies_en__v1_test");
    actual["fields"][4]["sort"] = json!(false);
    assert!(!compatible(&actual, "movies_en__v1_test"));
    assert!(owned("movies_en__v1_ABC_12"));
    assert!(!owned("movies_en__v1_"));
    assert!(!owned("movies_en__v1_x/evil"));
    assert!(!owned("games_en__123"));
}
#[tokio::test]
async fn bootstrap_publishes_only_after_scan_and_replay_with_canonical_date() {
    let (source, backend) = setup(501);
    let canonical = chrono::NaiveDate::from_ymd_opt(2026, 11, 5).unwrap();
    source.model.lock().unwrap().publication.source_date = Some(canonical);
    assert_eq!(
        run(&Io::default(), &backend, &source, limits(50_000))
            .await
            .unwrap(),
        JobOutcome::Completed
    );
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.published_date, Some(canonical));
    assert_eq!(m.scans, vec![None, Some(Uuid::from_u128(500))]);
    assert!(m.rows.values().all(|row| row.applied == 1));
    assert_eq!(
        backend.engine.lock().unwrap().docs[m.state.target().unwrap()].len(),
        501
    );
}
#[tokio::test]
async fn partial_import_never_acknowledges_or_advances_cursor_and_retry_is_idempotent() {
    let (source, backend) = setup(2);
    backend.engine.lock().unwrap().fail_import = true;
    assert!(
        run(&Io::default(), &backend, &source, limits(50_000))
            .await
            .is_err()
    );
    let target = {
        let m = source.model.lock().unwrap();
        assert!(!m.ready);
        assert!(m.acknowledgements.is_empty());
        assert_eq!(m.state.cursor, None);
        m.state.target().unwrap().to_owned()
    };
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.state.target(), Some(target.as_str()));
}
#[tokio::test]
async fn cancel_after_committed_batch_resumes_cursor_in_a_new_job() {
    let (source, backend) = setup(501);
    let io = Io {
        stop_after: Some(1),
        ..Default::default()
    };
    assert_eq!(
        run(&io, &backend, &source, limits(50_000)).await.unwrap(),
        JobOutcome::Interrupted
    );
    {
        let m = source.model.lock().unwrap();
        assert!(!m.ready);
        assert_eq!(m.state.cursor, Some(Uuid::from_u128(500)));
    }
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.scans, vec![None, Some(Uuid::from_u128(500))]);
}
#[tokio::test]
async fn captured_revision_ack_preserves_a_concurrent_source_change_for_replay() {
    let (source, backend) = setup(1);
    backend.engine.lock().unwrap().revision_race = true;
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert_eq!(
        m.acknowledgements,
        vec![(Uuid::from_u128(1), 1), (Uuid::from_u128(1), 2)]
    );
    let e = backend.engine.lock().unwrap();
    assert_eq!(
        e.docs[m.state.target().unwrap()][&Uuid::from_u128(1).to_string()]["title"],
        "Changed concurrently"
    );
}
#[tokio::test]
async fn ranking_change_during_import_replays_new_scores_before_readiness() {
    let (source, backend) = setup(1);
    backend.engine.lock().unwrap().generation_race = true;
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.publication.generation, 1);
    assert_eq!(m.published_date, m.publication.source_date);
    let e = backend.engine.lock().unwrap();
    assert_eq!(
        e.docs[m.state.target().unwrap()][&Uuid::from_u128(1).to_string()]["interestScore"],
        42
    );
}
#[tokio::test]
async fn ranking_change_between_alias_and_state_publication_cannot_publish_old_generation() {
    let (source, backend) = setup(1);
    backend.engine.lock().unwrap().alias_generation_race = true;
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.publications, 1);
    assert_eq!(m.published_date, m.publication.source_date);
    assert_eq!(m.rows.values().next().unwrap().applied, 2);
}
#[tokio::test]
async fn alias_state_crash_gap_resumes_the_same_shadow_without_rescanning() {
    let (source, backend) = setup(1);
    backend.engine.lock().unwrap().crash_alias = true;
    assert!(
        run(&Io::default(), &backend, &source, limits(50_000))
            .await
            .is_err()
    );
    let target = {
        let m = source.model.lock().unwrap();
        assert!(!m.ready);
        assert!(m.state.active_collection.is_none());
        m.state.target().unwrap().to_owned()
    };
    assert_eq!(
        backend.engine.lock().unwrap().alias.as_deref(),
        Some(target.as_str())
    );
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.state.target(), Some(target.as_str()));
    assert_eq!(m.scans.len(), 1);
}
#[tokio::test]
async fn missing_and_nonpublic_sources_are_deleted_and_tombstones_do_not_loop() {
    let (source, backend) = setup(2);
    ready(&source, &backend);
    {
        let mut m = source.model.lock().unwrap();
        for row in m.rows.values_mut() {
            row.document = None;
            row.requested += 1;
        }
    }
    // First is an indexed deletion; second represents an already-absent 404.
    backend
        .engine
        .lock()
        .unwrap()
        .docs
        .get_mut("movies_en__v1_existing")
        .unwrap()
        .remove(&Uuid::from_u128(2).to_string());
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(
        m.rows
            .values()
            .all(|row| row.applied == 2 && row.target.as_deref() == Some("movies_en__v1_existing"))
    );
    let e = backend.engine.lock().unwrap();
    assert_eq!(e.deletions, 2);
    assert!(e.docs["movies_en__v1_existing"].is_empty());
}
#[tokio::test]
async fn bounded_bootstrap_continues_only_after_progress_with_remaining_work() {
    let (source, backend) = setup(501);
    assert!(
        matches!(run(&Io::default(),&backend,&source,limits(500)).await.unwrap(),JobOutcome::CompletedWithContinuation{run_at} if run_at>=Utc::now()+ChronoDuration::seconds(29))
    );
    assert!(!source.model.lock().unwrap().ready);
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    assert!(source.model.lock().unwrap().ready);
    let (source, backend) = setup(1);
    assert_eq!(
        run(&Io::default(), &backend, &source, limits(0))
            .await
            .unwrap(),
        JobOutcome::Completed
    );
}
#[tokio::test]
async fn empty_steady_state_does_not_enqueue_a_continuation() {
    let (source, backend) = setup(0);
    ready(&source, &backend);
    assert_eq!(
        run(&Io::default(), &backend, &source, limits(500))
            .await
            .unwrap(),
        JobOutcome::Completed
    );
    assert_eq!(backend.engine.lock().unwrap().imports, 0);
}
#[tokio::test]
async fn daily_repair_advances_bounded_cursor_and_discovers_hard_deletions() {
    let (source, backend) = setup(501);
    ready(&source, &backend);
    {
        let mut m = source.model.lock().unwrap();
        m.repair_due = true;
        m.rows.get_mut(&Uuid::from_u128(501)).unwrap().document = None;
    }
    assert!(matches!(
        run(&Io::default(), &backend, &source, limits(500))
            .await
            .unwrap(),
        JobOutcome::CompletedWithContinuation { .. }
    ));
    {
        let m = source.model.lock().unwrap();
        assert_eq!(m.repair_cursor, Some(Uuid::from_u128(500)));
        assert!(m.repair_due);
    }
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(!m.repair_due);
    assert_eq!(m.repair_cursor, None);
    assert_eq!(m.rows[&Uuid::from_u128(501)].applied, 2);
    assert_eq!(backend.engine.lock().unwrap().deletions, 1);
}
#[tokio::test]
async fn incompatible_or_missing_target_rebuilds_without_deleting_unknown_collections() {
    let (source, backend) = setup(1);
    ready(&source, &backend);
    {
        let mut m = source.model.lock().unwrap();
        m.state.active_collection = Some("unrelated_collection".into());
    }
    backend.engine.lock().unwrap().schemas.insert(
        "unrelated_collection".into(),
        json!({"name":"unrelated_collection"}),
    );
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert!(owned(m.state.target().unwrap()));
    let e = backend.engine.lock().unwrap();
    assert!(e.schemas.contains_key("unrelated_collection"));
    assert!(e.deleted_collections.is_empty());
}

#[tokio::test]
async fn selected_uuid_cursor_survives_visibility_change_before_canonical_capture() {
    let (source, backend) = setup(501);
    source.model.lock().unwrap().visibility_race = true;
    let io = Io {
        stop_after: Some(1),
        ..Default::default()
    };
    assert_eq!(
        run(&io, &backend, &source, limits(50_000)).await.unwrap(),
        JobOutcome::Interrupted
    );
    assert_eq!(
        source.model.lock().unwrap().state.cursor,
        Some(Uuid::from_u128(500))
    );
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.rows[&Uuid::from_u128(500)].applied, 2);
    let e = backend.engine.lock().unwrap();
    assert_eq!(e.deletions, 1);
    assert_eq!(e.docs[m.state.target().unwrap()].len(), 500);
}

#[tokio::test]
async fn ack_cursor_crash_reimports_without_losing_pending_source_updates() {
    let (source, backend) = setup(1);
    source.model.lock().unwrap().fail_cursor_once = true;
    assert!(
        run(&Io::default(), &backend, &source, limits(50_000))
            .await
            .is_err()
    );
    {
        let mut m = source.model.lock().unwrap();
        assert_eq!(m.state.cursor, None);
        assert_eq!(m.rows[&Uuid::from_u128(1)].applied, 1);
        let row = m.rows.get_mut(&Uuid::from_u128(1)).unwrap();
        row.requested += 1;
        row.document.as_mut().unwrap()["title"] = json!("Changed after ACK");
    }
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.rows[&Uuid::from_u128(1)].applied, 2);
    assert_eq!(m.scans, vec![None, None]);
}

#[tokio::test]
async fn missing_physical_target_preserves_old_alias_and_active_while_rebuilding() {
    let (source, backend) = setup(501);
    ready(&source, &backend);
    backend
        .engine
        .lock()
        .unwrap()
        .schemas
        .remove("movies_en__v1_existing");
    assert!(matches!(
        run(&Io::default(), &backend, &source, limits(500))
            .await
            .unwrap(),
        JobOutcome::CompletedWithContinuation { .. }
    ));
    let m = source.model.lock().unwrap();
    assert!(!m.ready);
    assert_eq!(
        m.state.active_collection.as_deref(),
        Some("movies_en__v1_existing")
    );
    assert!(m.state.building_collection.is_some());
    assert_ne!(m.state.building_collection, m.state.active_collection);
    let e = backend.engine.lock().unwrap();
    assert_eq!(e.alias.as_deref(), Some("movies_en__v1_existing"));
    assert!(e.deleted_collections.is_empty());
}

#[tokio::test]
async fn preexisting_cancellation_does_not_prepare_or_publish_anything() {
    let (source, backend) = setup(1);
    let io = Io {
        stop_after: Some(0),
        ..Default::default()
    };
    assert_eq!(
        run(&io, &backend, &source, limits(50_000)).await.unwrap(),
        JobOutcome::Interrupted
    );
    let m = source.model.lock().unwrap();
    assert!(m.state.target().is_none());
    assert!(m.acknowledgements.is_empty());
    assert!(backend.engine.lock().unwrap().schemas.is_empty());
}
