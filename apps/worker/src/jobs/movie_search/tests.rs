use super::*;
use std::collections::{BTreeMap, HashSet};
use std::sync::Mutex;

use super::super::search::fake::FakeMeili;
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
    swap_decisions: usize,
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
                            json!({"id":id,"title":format!("Film {index}"),"interestScore":-1,
                                "recognitionCount":0,"interestRecognitionRank":0}),
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
                schema_version: SCHEMA_VERSION,
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
            swap_decisions: 0,
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
        m.state.schema_version = SCHEMA_VERSION;
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
    async fn begin_swap(&self, build: &str, publication: Publication) -> Result<bool> {
        let mut m = self.model.lock().unwrap();
        if !m.valid(build, publication) || m.state.building_collection.as_deref() != Some(build) {
            return Ok(false);
        }
        m.state.phase = "swap".into();
        m.swap_decisions += 1;
        Ok(true)
    }
    async fn finish_swap(&self, build: &str) -> Result<()> {
        let mut m = self.model.lock().unwrap();
        anyhow::ensure!(
            m.state.phase == "swap" && m.state.building_collection.as_deref() == Some(build),
            "movie bootstrap target changed"
        );
        m.state.active_collection = Some(ALIAS.into());
        m.state.building_collection = None;
        m.state.phase = "ready".into();
        m.ready = false;
        m.publication.generation += 1;
        Ok(())
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

/// Race hooks around the shared Meilisearch fake.
#[derive(Default)]
struct Hooks {
    revision_race: bool,
    generation_race: bool,
    swap_generation_race: bool,
}
struct Backend {
    meili: FakeMeili,
    hooks: Mutex<Hooks>,
    model: Arc<Mutex<Model>>,
}
impl Backend {
    fn docs(&self) -> usize {
        self.meili.doc_count(ALIAS)
    }
    fn doc(&self, id: u128) -> Value {
        self.meili
            .doc(ALIAS, &Uuid::from_u128(id).to_string())
            .unwrap()
    }
}
#[async_trait]
impl SearchBackend for Backend {
    async fn index_exists(&self, uid: &str) -> Result<bool> {
        self.meili.index_exists(uid).await
    }
    async fn list_indexes(&self) -> Result<Vec<String>> {
        self.meili.list_indexes().await
    }
    async fn settings(&self, uid: &str) -> Result<Option<Value>> {
        self.meili.settings(uid).await
    }
    async fn create_index(&self, uid: &str, settings: &Value) -> Result<()> {
        self.meili.create_index(uid, settings).await
    }
    async fn delete_index(&self, uid: &str) -> Result<bool> {
        self.meili.delete_index(uid).await
    }
    async fn swap_indexes(&self, pairs: &[(&str, &str)]) -> Result<()> {
        let result = self.meili.swap_indexes(pairs).await;
        let mut hooks = self.hooks.lock().unwrap();
        if hooks.swap_generation_race {
            hooks.swap_generation_race = false;
            self.model.lock().unwrap().change_ranking();
        }
        result
    }
    async fn was_swapped(&self, uid: &str) -> Result<bool> {
        self.meili.was_swapped(uid).await
    }
    async fn add_documents(&self, uid: &str, docs: &[Value]) -> Result<()> {
        self.meili.add_documents(uid, docs).await?;
        let mut hooks = self.hooks.lock().unwrap();
        if hooks.revision_race {
            hooks.revision_race = false;
            let mut m = self.model.lock().unwrap();
            let row = m.rows.values_mut().next().unwrap();
            row.requested += 1;
            row.document.as_mut().unwrap()["title"] = json!("Changed concurrently");
        }
        if hooks.generation_race {
            hooks.generation_race = false;
            self.model.lock().unwrap().change_ranking();
        }
        Ok(())
    }
    async fn delete_documents(&self, uid: &str, ids: &[String]) -> Result<()> {
        self.meili.delete_documents(uid, ids).await
    }
    async fn document_ids(&self, _: &str) -> Result<HashSet<String>> {
        panic!("movie sync must never fetch all IDs")
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
            meili: FakeMeili::default(),
            hooks: Mutex::new(Hooks::default()),
        },
    )
}
fn limits(documents: usize) -> Limits {
    Limits {
        documents,
        duration: Duration::from_secs(60),
    }
}
/// A published Meilisearch-era state with every row in `movies_en`.
fn ready(source: &FakeSource, backend: &Backend) {
    let mut m = source.model.lock().unwrap();
    m.state.active_collection = Some(ALIAS.into());
    m.state.phase = "ready".into();
    m.ready = true;
    let mut s = backend.meili.state.lock().unwrap();
    let index = s.indexes.entry(ALIAS.into()).or_default();
    index.settings = index_settings();
    for (id, row) in &mut m.rows {
        row.applied = row.requested;
        row.target = Some(ALIAS.into());
        if let Some(doc) = &row.document {
            index.docs.insert(id.to_string(), doc.clone());
        }
    }
}
fn build_indexes(backend: &Backend) -> Vec<String> {
    backend
        .meili
        .names()
        .into_iter()
        .filter(|name| name.contains("__build_"))
        .collect()
}

#[test]
fn movie_settings_and_build_names() {
    let settings = index_settings();
    // "rango 2011" ranks Rango (2011) first through the words rule; a 4-letter
    // year never typo-matches its neighbours.
    assert_eq!(
        settings["searchableAttributes"],
        json!(["title", "originalTitle", "releaseYear"])
    );
    assert_eq!(
        settings["typoTolerance"]["minWordSizeForTypos"]["oneTypo"],
        json!(5)
    );
    assert_eq!(settings["filterableAttributes"], json!(["personQids"]));
    assert_eq!(
        settings["sortableAttributes"],
        json!([
            "interestRecognitionRank",
            "interestScore",
            "recognitionCount",
            "titleSort",
            "tieBreakId"
        ])
    );
    assert!(owned("movies_en__build_ABC12"));
    assert!(!owned("movies_en__build_"));
    assert!(!owned("movies_en__build_x/evil"));
    assert!(!owned("movies_en__v2_abc"));
    assert!(!owned("movie_people_en__build_abc"));
}

#[tokio::test]
async fn typesense_era_state_starts_a_new_build_and_publishes_the_stable_uid() {
    let (source, backend) = setup(501);
    {
        let mut m = source.model.lock().unwrap();
        m.state.schema_version = 2;
        m.state.active_collection = Some("movies_en__v2_live".into());
        m.state.building_collection = Some("movies_en__v2_partial".into());
        m.state.cursor = Some(Uuid::from_u128(500));
    }
    assert!(matches!(
        run(&Io::default(), &backend, &source, limits(500))
            .await
            .unwrap(),
        JobOutcome::CompletedWithContinuation { .. }
    ));
    {
        let m = source.model.lock().unwrap();
        assert_eq!(m.state.schema_version, SCHEMA_VERSION);
        assert_eq!(
            m.state.active_collection.as_deref(),
            Some("movies_en__v2_live"),
            "the API keeps falling back to SQL until the swap"
        );
        assert!(owned(m.state.building_collection.as_deref().unwrap()));
        assert_eq!(m.scans, vec![None]);
        assert!(!m.ready);
        assert!(!backend.meili.exists(ALIAS));
    }
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.state.active_collection.as_deref(), Some(ALIAS));
    assert!(m.state.building_collection.is_none());
    assert_eq!(backend.docs(), 501);
    assert_eq!(
        backend.meili.state.lock().unwrap().indexes[ALIAS].settings,
        index_settings()
    );
    assert!(build_indexes(&backend).is_empty());
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
    assert_eq!(m.swap_decisions, 1);
    assert_eq!(m.publications, 1);
    assert_eq!(m.published_date, Some(canonical));
    assert_eq!(m.publication.generation, 1, "the swap bumps the generation");
    assert_eq!(m.scans, vec![None, Some(Uuid::from_u128(500))]);
    assert!(m.rows.values().all(|row| row.applied == 1));
    assert_eq!(backend.docs(), 501);
}
#[tokio::test]
async fn partial_import_never_acknowledges_or_advances_cursor_and_retry_is_idempotent() {
    let (source, backend) = setup(2);
    backend.meili.state.lock().unwrap().fail_next_add = true;
    assert!(
        run(&Io::default(), &backend, &source, limits(50_000))
            .await
            .is_err()
    );
    let build = {
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
    assert_eq!(
        backend.meili.state.lock().unwrap().swaps,
        vec![vec![(build, ALIAS.to_string())]],
        "the retry swapped in the same build"
    );
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
    backend.hooks.lock().unwrap().revision_race = true;
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert_eq!(
        m.acknowledgements,
        vec![(Uuid::from_u128(1), 1), (Uuid::from_u128(1), 2)]
    );
    assert_eq!(backend.doc(1)["title"], "Changed concurrently");
}
#[tokio::test]
async fn ranking_change_during_import_replays_new_scores_before_readiness() {
    let (source, backend) = setup(1);
    backend.hooks.lock().unwrap().generation_race = true;
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.published_date, m.publication.source_date);
    assert_eq!(backend.doc(1)["interestScore"], 42);
}
#[tokio::test]
async fn ranking_change_during_the_swap_is_drained_before_readiness() {
    let (source, backend) = setup(1);
    backend.hooks.lock().unwrap().swap_generation_race = true;
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.publications, 1);
    assert_eq!(m.published_date, m.publication.source_date);
    assert_eq!(m.rows.values().next().unwrap().applied, 2);
    assert_eq!(backend.doc(1)["interestScore"], 42);
}
#[tokio::test]
async fn crash_after_the_swap_resumes_without_a_second_swap_or_rescan() {
    let (source, backend) = setup(1);
    backend.meili.state.lock().unwrap().crash_after_swap = true;
    assert!(
        run(&Io::default(), &backend, &source, limits(50_000))
            .await
            .is_err()
    );
    {
        let m = source.model.lock().unwrap();
        assert!(!m.ready);
        assert_eq!(m.state.phase, "swap");
        assert!(m.state.active_collection.is_none());
    }
    assert_eq!(backend.docs(), 1, "the swap itself succeeded");
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.state.target(), Some(ALIAS));
    assert_eq!(m.scans.len(), 1);
    assert_eq!(backend.meili.state.lock().unwrap().swaps.len(), 1);
    assert!(build_indexes(&backend).is_empty());
}
#[tokio::test]
async fn swap_phase_without_its_build_or_a_finished_swap_starts_a_fresh_build() {
    let (source, backend) = setup(3);
    {
        let mut m = source.model.lock().unwrap();
        m.state.building_collection = Some("movies_en__build_lost".into());
        m.state.phase = "swap".into();
    }
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.state.target(), Some(ALIAS));
    assert_eq!(backend.docs(), 3);
    assert_eq!(m.scans.len(), 1, "rebuilt from a fresh scan");
}

#[tokio::test]
async fn a_failed_build_delete_is_retried_on_the_next_run() {
    let (source, backend) = setup(1);
    ready(&source, &backend);
    backend
        .meili
        .state
        .lock()
        .unwrap()
        .indexes
        .insert("movies_en__build_leftover".into(), Default::default());
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    assert!(build_indexes(&backend).is_empty());
    assert!(source.model.lock().unwrap().ready);
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
    // First is an indexed deletion; second is already absent.
    backend
        .meili
        .state
        .lock()
        .unwrap()
        .indexes
        .get_mut(ALIAS)
        .unwrap()
        .docs
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
            .all(|row| row.applied == 2 && row.target.as_deref() == Some(ALIAS))
    );
    assert_eq!(backend.meili.state.lock().unwrap().document_deletions, 2);
    assert_eq!(backend.docs(), 0);
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
    assert_eq!(backend.meili.state.lock().unwrap().adds, 0);
    assert!(backend.meili.state.lock().unwrap().swaps.is_empty());
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
    assert_eq!(backend.meili.state.lock().unwrap().document_deletions, 1);
}
#[tokio::test]
async fn outdated_live_settings_rebuild_without_deleting_unknown_indexes() {
    let (source, backend) = setup(1);
    ready(&source, &backend);
    {
        let mut s = backend.meili.state.lock().unwrap();
        s.indexes.get_mut(ALIAS).unwrap().settings = json!({ "searchableAttributes": ["title"] });
        s.indexes.insert("unrelated".into(), Default::default());
        s.indexes
            .insert("movies_en__build_abandoned".into(), Default::default());
    }
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    let m = source.model.lock().unwrap();
    assert!(m.ready);
    assert_eq!(m.state.target(), Some(ALIAS));
    let s = backend.meili.state.lock().unwrap();
    assert_eq!(s.indexes[ALIAS].settings, index_settings());
    assert!(s.indexes.contains_key("unrelated"));
    assert!(!s.indexes.keys().any(|name| name.contains("__build_")));
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
    assert_eq!(backend.meili.state.lock().unwrap().document_deletions, 1);
    assert_eq!(backend.docs(), 500);
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
    assert_eq!(backend.doc(1)["title"], "Changed after ACK");
}

#[tokio::test]
async fn missing_live_index_keeps_the_state_unready_while_rebuilding() {
    let (source, backend) = setup(501);
    ready(&source, &backend);
    backend.meili.state.lock().unwrap().indexes.remove(ALIAS);
    assert!(matches!(
        run(&Io::default(), &backend, &source, limits(500))
            .await
            .unwrap(),
        JobOutcome::CompletedWithContinuation { .. }
    ));
    {
        let m = source.model.lock().unwrap();
        assert!(!m.ready, "the API falls back to SQL during the rebuild");
        assert!(owned(m.state.building_collection.as_deref().unwrap()));
    }
    run(&Io::default(), &backend, &source, limits(50_000))
        .await
        .unwrap();
    assert!(source.model.lock().unwrap().ready);
    assert_eq!(backend.docs(), 501);
    assert!(build_indexes(&backend).is_empty(), "renamed into place");
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
    assert!(backend.meili.names().is_empty());
}
