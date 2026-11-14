//! Job-logic tests for `search.reindex` and `search.sync` against in-memory
//! fakes of Meilisearch, the source database and the job context.

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use anyhow::Result;
use async_trait::async_trait;
use chrono::{DateTime, TimeZone, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

use super::fake::FakeMeili;
use super::full::{self, FullCheckpoint};
use super::indexes::{INDEXES, Source};
use super::rebuild_reason;
use super::source::{DocPage, SourceData};
use super::sync::{self, SyncCheckpoint, diff};
use crate::context::{JobIo, Progress};
use crate::handler::{JobOutcome, is_permanent};
use crate::queue::LogLevel;

// --- Fakes ---

#[derive(Default)]
struct FakeIo {
    /// `should_stop()` turns true once this many checkpoints were saved.
    stop_after_checkpoints: Option<usize>,
    cancel: bool,
    checkpoints: Mutex<Vec<Value>>,
    logs: Mutex<Vec<(LogLevel, String)>>,
    progress: Mutex<Vec<Progress>>,
}

impl FakeIo {
    fn stopping_after(n: usize, cancel: bool) -> Self {
        Self {
            stop_after_checkpoints: Some(n),
            cancel,
            ..Default::default()
        }
    }
    fn last_checkpoint(&self) -> Value {
        self.checkpoints.lock().unwrap().last().cloned().unwrap()
    }
    fn logs(&self) -> Vec<String> {
        self.logs
            .lock()
            .unwrap()
            .iter()
            .map(|(_, m)| m.clone())
            .collect()
    }
    fn last_progress(&self) -> Progress {
        self.progress.lock().unwrap().last().cloned().unwrap()
    }
}

#[async_trait]
impl JobIo for FakeIo {
    fn should_stop(&self) -> bool {
        self.stop_after_checkpoints
            .is_some_and(|n| self.checkpoints.lock().unwrap().len() >= n)
    }
    fn is_cancel_requested(&self) -> bool {
        self.cancel && self.should_stop()
    }
    async fn log(&self, level: LogLevel, message: &str) {
        self.logs.lock().unwrap().push((level, message.to_string()));
    }
    async fn progress(&self, progress: &Progress) -> Result<()> {
        self.progress.lock().unwrap().push(progress.clone());
        Ok(())
    }
    async fn checkpoint(&self, progress: &Progress, checkpoint: Value) -> Result<()> {
        self.progress.lock().unwrap().push(progress.clone());
        self.checkpoints.lock().unwrap().push(checkpoint);
        Ok(())
    }
}

/// Source rows per collection name, sorted by id.
struct FakeSource {
    rows: HashMap<Source, Vec<(Uuid, Value)>>,
    /// Change time per row; rows without one changed long ago.
    changed_at: HashMap<Uuid, DateTime<Utc>>,
}

fn uuid(n: u128) -> Uuid {
    Uuid::from_u128(n)
}

impl FakeSource {
    /// `counts[i]` rows for `INDEXES[i]`, ids `i*1_000_000 + 1..`.
    fn new(counts: [usize; 7]) -> Self {
        let mut rows = HashMap::new();
        for (index, spec) in INDEXES.iter().enumerate() {
            let list = (1..=counts[index])
                .map(|n| {
                    let id = uuid(index as u128 * 1_000_000 + n as u128);
                    (id, json!({ "id": id.to_string(), "n": n }))
                })
                .collect();
            rows.insert(spec.source, list);
        }
        Self {
            rows,
            changed_at: HashMap::new(),
        }
    }
    /// Changes one row's document at `at`.
    fn touch(&mut self, collection: usize, nth: usize, at: DateTime<Utc>) {
        let list = self.rows.get_mut(&INDEXES[collection].source).unwrap();
        list[nth].1["n"] = json!("changed");
        let id = list[nth].0;
        self.changed_at.insert(id, at);
    }
    fn mark_failing(&mut self, collection: usize, nth: usize) {
        let list = self.rows.get_mut(&INDEXES[collection].source).unwrap();
        list[nth].1["fail"] = json!(true);
    }
    fn id(&self, collection: usize, nth: usize) -> Uuid {
        self.rows[&INDEXES[collection].source][nth].0
    }
}

#[async_trait]
impl SourceData for FakeSource {
    async fn count(&self, source: Source, up_to: Option<Uuid>) -> Result<u64> {
        Ok(self.rows[&source]
            .iter()
            .filter(|(id, _)| up_to.is_none_or(|u| *id <= u))
            .count() as u64)
    }
    async fn docs_page(
        &self,
        source: Source,
        after: Option<Uuid>,
        limit: usize,
    ) -> Result<DocPage> {
        let page: Vec<&(Uuid, Value)> = self.rows[&source]
            .iter()
            .filter(|(id, _)| after.is_none_or(|a| *id > a))
            .take(limit)
            .collect();
        Ok(DocPage {
            last_id: page.last().map(|(id, _)| *id),
            docs: page.into_iter().map(|(_, d)| d.clone()).collect(),
        })
    }
    async fn ids_page(
        &self,
        source: Source,
        after: Option<Uuid>,
        limit: usize,
    ) -> Result<Vec<Uuid>> {
        Ok(self.rows[&source]
            .iter()
            .filter(|(id, _)| after.is_none_or(|a| *id > a))
            .take(limit)
            .map(|(id, _)| *id)
            .collect())
    }
    async fn docs_by_ids(&self, source: Source, ids: &[Uuid]) -> Result<Vec<Value>> {
        let wanted: HashSet<&Uuid> = ids.iter().collect();
        Ok(self.rows[&source]
            .iter()
            .filter(|(id, _)| wanted.contains(id))
            .map(|(_, d)| d.clone())
            .collect())
    }
    async fn changed_page(
        &self,
        source: Source,
        since: DateTime<Utc>,
        after: Option<Uuid>,
        limit: usize,
    ) -> Result<DocPage> {
        let page: Vec<&(Uuid, Value)> = self.rows[&source]
            .iter()
            .filter(|(id, _)| after.is_none_or(|a| *id > a))
            .filter(|(id, _)| self.changed_at.get(id).is_some_and(|at| *at >= since))
            .take(limit)
            .collect();
        Ok(DocPage {
            last_id: page.last().map(|(id, _)| *id),
            docs: page.into_iter().map(|(_, d)| d.clone()).collect(),
        })
    }
}

fn t(h: u32, m: u32, s: u32) -> DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 11, 4, h, m, s).unwrap()
}

const SUFFIX: &str = "20261104030007";
const COUNTS: [usize; 7] = [1200, 3, 2, 1, 0, 4, 2];

fn build(name: &str) -> String {
    format!("{name}__build_{SUFFIX}")
}

fn op_index(ops: &[String], pred: impl Fn(&str) -> bool) -> Vec<usize> {
    ops.iter()
        .enumerate()
        .filter(|(_, o)| pred(o))
        .map(|(i, _)| i)
        .collect()
}

/// Every stable index present with current settings and `docs[i]` orphans.
fn live(docs: &[usize; 7]) -> FakeMeili {
    let indexes: Vec<(&str, usize, Value)> = INDEXES
        .iter()
        .zip(docs)
        .map(|(spec, n)| (spec.name, *n, spec.settings()))
        .collect();
    FakeMeili::with(&indexes)
}

// --- search.reindex ---

#[tokio::test]
async fn full_reindex_swaps_only_after_every_index_is_loaded() {
    let backend = FakeMeili::with(&[
        ("games_en", 5, json!({})), // outdated live index
        ("publishers_en__build_20240101000000", 1, json!({})), // stale build
        ("unrelated", 1, json!({})), // not ours
    ]);
    let source = FakeSource::new(COUNTS);
    let io = FakeIo::default();

    let outcome = full::run(&io, &backend, &source, None, t(3, 0, 7))
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Completed);

    let ops = backend.ops();
    let adds = op_index(&ops, |o| o.starts_with("add "));
    let swaps = op_index(&ops, |o| o.starts_with("swap "));
    let creates = op_index(&ops, |o| o.starts_with("create "));
    assert_eq!(swaps.len(), 1, "one atomic swap: {ops:?}");
    assert!(adds.iter().max() < swaps.iter().min());
    assert!(creates.iter().max() < adds.iter().min());
    assert_eq!(creates.len(), 7);

    // The stale build is removed before the new run starts.
    let stale = ops
        .iter()
        .position(|o| o == "delete publishers_en__build_20240101000000")
        .unwrap();
    assert!(stale < creates[0]);

    // The swapped-out build (old games_en contents) is deleted afterwards;
    // the other builds were renamed into place.
    let previous = ops
        .iter()
        .position(|o| *o == format!("delete {}", build("games_en")))
        .unwrap();
    assert!(previous > swaps[0]);

    for (index, spec) in INDEXES.iter().enumerate() {
        assert_eq!(backend.doc_count(spec.name), COUNTS[index], "{}", spec.name);
        assert_eq!(
            backend.state.lock().unwrap().indexes[spec.name].settings,
            spec.settings()
        );
    }
    let mut remaining = backend.names();
    remaining.sort();
    let mut expected: Vec<String> = INDEXES.iter().map(|s| s.name.to_string()).collect();
    expected.push("unrelated".into());
    expected.sort();
    assert_eq!(remaining, expected);

    // Determinate progress: total known up front, reached at the end.
    let total: u64 = COUNTS.iter().sum::<usize>() as u64;
    let last = io.last_progress();
    assert_eq!(last.total, Some(total));
    assert_eq!(last.processed, Some(total));
    let phases: Vec<String> = io
        .progress
        .lock()
        .unwrap()
        .iter()
        .filter_map(|p| p.phase.clone())
        .collect();
    for expected in [
        "counting",
        "indexing:games_en",
        "indexing:posts_en",
        "swapping indexes",
        "cleanup",
    ] {
        assert!(
            phases.iter().any(|p| p == expected),
            "missing phase {expected}"
        );
    }
    assert!(
        io.logs()
            .iter()
            .any(|l| l == "games_en: 1200 documents indexed")
    );
}

#[tokio::test]
async fn full_reindex_resumes_into_the_same_build_indexes() {
    let backend = FakeMeili::default();
    let source = FakeSource::new(COUNTS);

    // Checkpoint 1 = after counting, 2 = after the first games batch.
    let first = FakeIo::stopping_after(2, false);
    let outcome = full::run(&first, &backend, &source, None, t(3, 0, 7))
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Interrupted);
    assert!(backend.ops().iter().all(|o| !o.starts_with("swap ")));

    let cp: FullCheckpoint = serde_json::from_value(first.last_checkpoint()).unwrap();
    assert_eq!(
        cp,
        FullCheckpoint {
            suffix: SUFFIX.into(),
            collection_index: 0,
            last_id: Some(source.id(0, 499)),
            started_at: Some(t(3, 0, 7)),
        }
    );
    assert_eq!(
        first.last_checkpoint(),
        json!({ "suffix": SUFFIX, "collectionIndex": 0, "lastId": source.id(0, 499).to_string(),
            "startedAt": "2026-11-04T03:00:07Z" })
    );

    // Resume an hour later: still the original suffix, nothing re-imported.
    let ops_before = backend.ops().len();
    let second = FakeIo::default();
    let outcome = full::run(&second, &backend, &source, Some(cp), t(4, 0, 0))
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Completed);
    let resumed_ops = &backend.ops()[ops_before..];
    assert!(
        resumed_ops.iter().all(|o| !o.starts_with("create ")),
        "{resumed_ops:?}"
    );
    assert_eq!(
        resumed_ops
            .iter()
            .filter(|o| o.starts_with(&format!("add {}", build("games_en"))))
            .count(),
        2
    );
    assert_eq!(backend.doc_count("games_en"), 1200);
    assert!(backend.names().iter().all(|n| !n.contains("__build_")));

    let first_progress = second
        .progress
        .lock()
        .unwrap()
        .iter()
        .find(|p| p.processed.is_some())
        .cloned()
        .unwrap();
    assert_eq!(first_progress.processed, Some(500));
}

#[tokio::test]
async fn full_reindex_re_indexes_rows_changed_during_the_rebuild() {
    let backend = FakeMeili::default();
    let mut source = FakeSource::new(COUNTS);
    // Interrupted after the first games batch (rows 0..500 loaded).
    let first = FakeIo::stopping_after(2, false);
    full::run(&first, &backend, &source, None, t(3, 0, 7))
        .await
        .unwrap();
    let cp: FullCheckpoint = serde_json::from_value(first.last_checkpoint()).unwrap();

    // Changed after being loaded into the build (its API write went to the
    // old index), plus a row changed long before the run.
    source.touch(0, 3, t(3, 30, 0));
    source.touch(1, 0, t(1, 0, 0));
    let second = FakeIo::default();
    let outcome = full::run(&second, &backend, &source, Some(cp), t(4, 0, 0))
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Completed);
    let changed = source.id(0, 3).to_string();
    assert_eq!(backend.doc("games_en", &changed).unwrap()["n"], "changed");

    let ops = backend.ops();
    let swap = op_index(&ops, |o| o.starts_with("swap "))[0];
    let catch_up = ops.iter().position(|o| o == "add games_en 1").unwrap();
    assert!(catch_up > swap, "{ops:?}");
    // Only rows changed since the run start (minus the margin) are repeated.
    assert_eq!(
        ops[swap..].iter().filter(|o| o.starts_with("add ")).count(),
        1
    );
    assert!(
        second
            .logs()
            .iter()
            .any(|l| l == "games_en: 1 documents changed during the rebuild re-indexed")
    );
}

#[tokio::test]
async fn full_reindex_resumed_after_the_swap_only_cleans_up() {
    let backend = live(&[0; 7]);
    let source = FakeSource::new(COUNTS);
    backend.state.lock().unwrap().crash_after_swap = true;
    let first = FakeIo::default();
    assert!(
        full::run(&first, &backend, &source, None, t(3, 0, 7))
            .await
            .is_err()
    );
    let cp: FullCheckpoint = serde_json::from_value(first.last_checkpoint()).unwrap();
    assert_eq!(cp.collection_index, INDEXES.len());
    // The builds now hold the previous (empty) contents.
    assert!(backend.exists(&build("games_en")));
    assert_eq!(backend.doc_count("games_en"), 1200);

    let ops_before = backend.ops().len();
    let second = FakeIo::default();
    let outcome = full::run(&second, &backend, &source, Some(cp), t(4, 0, 0))
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Completed);
    let resumed = &backend.ops()[ops_before..];
    assert!(
        resumed.iter().all(|o| o.starts_with("delete ")),
        "no second swap or reindex: {resumed:?}"
    );
    assert_eq!(backend.doc_count("games_en"), 1200);
    assert!(backend.names().iter().all(|n| !n.contains("__build_")));
}

#[tokio::test]
async fn full_reindex_cancel_deletes_half_built_indexes() {
    let backend = live(&[3, 0, 0, 0, 0, 0, 0]);
    let source = FakeSource::new(COUNTS);
    let io = FakeIo::stopping_after(2, true);
    let outcome = full::run(&io, &backend, &source, None, t(3, 0, 7))
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Interrupted);
    assert!(backend.names().iter().all(|n| !n.contains("__build_")));
    assert_eq!(backend.doc_count("games_en"), 3);
    assert_eq!(io.last_checkpoint(), Value::Null);
}

#[tokio::test]
async fn full_reindex_failure_keeps_build_indexes_for_retry() {
    let backend = FakeMeili::default();
    let mut source = FakeSource::new(COUNTS);
    source.mark_failing(1, 1);
    let io = FakeIo::default();
    let err = full::run(&io, &backend, &source, None, t(3, 0, 7))
        .await
        .unwrap_err();
    assert!(
        err.to_string()
            .contains("developers_en: 3 documents failed to import"),
        "{err}"
    );
    assert!(io.logs().iter().any(|l| l.contains("Bad document")));
    assert_eq!(backend.names().len(), 7);
    assert!(backend.ops().iter().all(|o| !o.starts_with("swap ")));
    let cp: FullCheckpoint = serde_json::from_value(io.last_checkpoint()).unwrap();
    assert_eq!(cp.collection_index, 1);
    assert_eq!(cp.suffix, SUFFIX);
}

#[tokio::test]
async fn full_reindex_rebuilds_a_vanished_or_outdated_build_on_resume() {
    let backend = FakeMeili::default();
    let source = FakeSource::new(COUNTS);
    let first = FakeIo::stopping_after(5, false);
    full::run(&first, &backend, &source, None, t(3, 0, 7))
        .await
        .unwrap();
    let cp: FullCheckpoint = serde_json::from_value(first.last_checkpoint()).unwrap();
    assert!(cp.collection_index >= 1);
    {
        let mut s = backend.state.lock().unwrap();
        s.indexes.remove(&build("games_en"));
        // Settings changed by a new release between attempts.
        s.indexes.get_mut(&build("developers_en")).unwrap().settings =
            json!({ "searchableAttributes": ["name"] });
    }

    let second = FakeIo::default();
    let outcome = full::run(&second, &backend, &source, Some(cp), t(4, 0, 0))
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Completed);
    assert_eq!(backend.doc_count("games_en"), 1200);
    assert_eq!(backend.doc_count("developers_en"), 3);
    assert_eq!(
        backend.state.lock().unwrap().indexes["developers_en"].settings,
        INDEXES[1].settings()
    );
}

#[test]
fn full_checkpoint_serde() {
    let cp = FullCheckpoint {
        suffix: SUFFIX.into(),
        collection_index: 3,
        last_id: None,
        started_at: Some(t(3, 0, 7)),
    };
    let value = serde_json::to_value(&cp).unwrap();
    assert_eq!(
        value,
        json!({ "suffix": SUFFIX, "collectionIndex": 3, "lastId": null,
            "startedAt": "2026-11-04T03:00:07Z" })
    );
    assert_eq!(serde_json::from_value::<FullCheckpoint>(value).unwrap(), cp);
    // Checkpoints written before `startedAt` existed still decode.
    let legacy: FullCheckpoint =
        serde_json::from_value(json!({ "suffix": SUFFIX, "collectionIndex": 3, "lastId": null }))
            .unwrap();
    assert_eq!(legacy.started_at, None);
    // A sync checkpoint is never mistaken for a full one.
    assert!(serde_json::from_value::<FullCheckpoint>(json!({ "collectionIndex": 2 })).is_err());
}

// --- search.sync ---

#[tokio::test]
async fn rebuild_reason_detects_missing_and_outdated_indexes() {
    assert_eq!(rebuild_reason(&live(&[0; 7])).await.unwrap(), None);
    let missing = live(&[0; 7]);
    missing.state.lock().unwrap().indexes.remove("posts_en");
    assert_eq!(
        rebuild_reason(&missing).await.unwrap().as_deref(),
        Some("index posts_en does not exist")
    );
    let outdated = live(&[0; 7]);
    outdated
        .state
        .lock()
        .unwrap()
        .indexes
        .get_mut("games_en")
        .unwrap()
        .settings["pagination"] = json!({ "maxTotalHits": 1000 });
    assert_eq!(
        rebuild_reason(&outdated).await.unwrap().as_deref(),
        Some("index games_en has outdated settings")
    );
}

#[test]
fn diff_finds_missing_and_orphans() {
    let a = uuid(1);
    let b = uuid(2);
    let c = uuid(3);
    let indexed: HashSet<String> = [b.to_string(), "gone".to_string()].into_iter().collect();
    assert_eq!(
        diff([a, b, c], &indexed),
        sync::Diff {
            missing: vec![a, c],
            orphans: vec!["gone".to_string()]
        }
    );
    assert_eq!(diff(Vec::new(), &HashSet::new()), sync::Diff::default());
}

#[tokio::test]
async fn sync_indexes_missing_and_deletes_orphaned_documents() {
    // One orphan document in games; indexed: games 0..700 of 1200, themes 2 of 4.
    let backend = live(&[1, 0, 0, 0, 0, 0, 0]);
    backend
        .state
        .lock()
        .unwrap()
        .indexes
        .insert(build("posts_en"), Default::default());
    let source = FakeSource::new(COUNTS);
    for n in 0..700 {
        backend.insert_doc("games_en", &source.id(0, n).to_string());
    }
    for n in 0..2 {
        backend.insert_doc("themes_en", &source.id(5, n).to_string());
    }
    let expected_missing: u64 = [500, 3, 2, 1, 0, 2, 2].iter().sum();

    let io = FakeIo::default();
    let outcome = sync::run(&io, &backend, &source, None).await.unwrap();
    assert_eq!(outcome, JobOutcome::Completed);

    assert_eq!(backend.doc_count("games_en"), 1200); // the orphan is gone
    assert!(backend.doc("games_en", "orphan-0").is_none());
    assert_eq!(backend.state.lock().unwrap().document_deletions, 1);
    assert!(
        !backend.exists(&build("posts_en")),
        "leftover build deleted"
    );
    assert_eq!(backend.doc_count("themes_en"), 4);
    let adds: Vec<String> = backend
        .ops()
        .into_iter()
        .filter(|o| o.starts_with("add "))
        .collect();
    assert_eq!(adds[0], "add games_en 500");

    let logs = io.logs();
    assert!(
        logs.iter()
            .any(|l| l.starts_with("games_en: 500 missing, 1 orphaned")),
        "{logs:?}"
    );
    assert!(
        logs.iter()
            .any(|l| l == "games_en: 500 missing, 500 indexed, 1 orphans deleted")
    );
    assert!(
        logs.iter()
            .any(|l| l == "genres_en: 1 missing, 1 indexed, 0 orphans deleted")
    );

    let last = io.last_progress();
    assert_eq!(last.total, Some(expected_missing));
    assert_eq!(last.processed, Some(expected_missing));
    // Diffing happens (and the total is known) before any indexing.
    let ops = backend.ops();
    let fetches = op_index(&ops, |o| o.starts_with("ids "));
    let first_add = op_index(&ops, |o| o.starts_with("add "))[0];
    assert_eq!(fetches.len(), 7);
    assert!(fetches.iter().all(|e| *e < first_add));
    assert_eq!(
        serde_json::from_value::<SyncCheckpoint>(io.last_checkpoint())
            .unwrap()
            .collection_index,
        7
    );
}

#[tokio::test]
async fn sync_resume_skips_finished_indexes() {
    let backend = live(&[0; 7]);
    let source = FakeSource::new(COUNTS);
    let io = FakeIo::default();
    let outcome = sync::run(
        &io,
        &backend,
        &source,
        Some(SyncCheckpoint {
            collection_index: 1,
        }),
    )
    .await
    .unwrap();
    assert_eq!(outcome, JobOutcome::Completed);
    assert!(!backend.ops().iter().any(|o| o.contains("games_en")));
    assert_eq!(backend.doc_count("games_en"), 0);
    assert_eq!(backend.doc_count("themes_en"), 4);
}

#[tokio::test]
async fn sync_fails_clearly_when_an_index_is_missing() {
    let backend = live(&[0; 7]);
    backend.state.lock().unwrap().indexes.remove("posts_en");
    let source = FakeSource::new([1, 0, 0, 0, 0, 0, 0]);
    let err = sync::run(&FakeIo::default(), &backend, &source, None)
        .await
        .unwrap_err();
    assert!(is_permanent(&err));
    assert!(
        err.to_string()
            .contains("posts_en does not exist; run the full reindex"),
        "{err}"
    );
    assert!(backend.ops().is_empty());
}
