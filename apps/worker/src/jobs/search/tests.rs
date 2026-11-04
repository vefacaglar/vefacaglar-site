//! Job-logic tests for `search.reindex` and `search.sync` against in-memory
//! fakes of Typesense, the source database and the job context.

use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::Mutex;

use anyhow::Result;
use async_trait::async_trait;
use chrono::{DateTime, TimeZone, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

use super::backend::{ImportFailure, SearchBackend};
use super::collections::{COLLECTIONS, Source};
use super::full::{self, FullCheckpoint};
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

#[derive(Default)]
struct BackendState {
    collections: BTreeMap<String, BTreeMap<String, Value>>,
    aliases: BTreeMap<String, String>,
    ops: Vec<String>,
}

#[derive(Default)]
struct FakeBackend {
    state: Mutex<BackendState>,
}

impl FakeBackend {
    fn with(collections: &[(&str, usize)], aliases: &[(&str, &str)]) -> Self {
        let backend = Self::default();
        {
            let mut s = backend.state.lock().unwrap();
            for (name, docs) in collections {
                let mut map = BTreeMap::new();
                for i in 0..*docs {
                    let id = format!("orphan-{i}");
                    map.insert(id.clone(), json!({ "id": id }));
                }
                s.collections.insert(name.to_string(), map);
            }
            for (alias, target) in aliases {
                s.aliases.insert(alias.to_string(), target.to_string());
            }
        }
        backend
    }
    fn ops(&self) -> Vec<String> {
        self.state.lock().unwrap().ops.clone()
    }
    fn alias(&self, name: &str) -> Option<String> {
        self.state.lock().unwrap().aliases.get(name).cloned()
    }
    fn collection_names(&self) -> Vec<String> {
        self.state
            .lock()
            .unwrap()
            .collections
            .keys()
            .cloned()
            .collect()
    }
    fn doc_count(&self, name: &str) -> usize {
        self.state
            .lock()
            .unwrap()
            .collections
            .get(name)
            .map_or(0, |c| c.len())
    }
    fn insert_doc(&self, collection: &str, id: &str) {
        self.state
            .lock()
            .unwrap()
            .collections
            .get_mut(collection)
            .unwrap()
            .insert(id.to_string(), json!({ "id": id }));
    }
}

#[async_trait]
impl SearchBackend for FakeBackend {
    async fn get_alias(&self, name: &str) -> Result<Option<String>> {
        Ok(self.alias(name))
    }
    async fn collection_exists(&self, name: &str) -> Result<bool> {
        Ok(self.state.lock().unwrap().collections.contains_key(name))
    }
    async fn list_collections(&self) -> Result<Vec<String>> {
        Ok(self.collection_names())
    }
    async fn create_collection(&self, schema: &Value) -> Result<()> {
        let name = schema["name"].as_str().unwrap().to_string();
        let mut s = self.state.lock().unwrap();
        s.ops.push(format!("create {name}"));
        s.collections.entry(name).or_default();
        Ok(())
    }
    async fn delete_collection(&self, name: &str) -> Result<bool> {
        let mut s = self.state.lock().unwrap();
        assert!(
            !s.aliases.values().any(|t| t == name),
            "deleted {name} while an alias points to it"
        );
        let existed = s.collections.remove(name).is_some();
        if existed {
            s.ops.push(format!("delete {name}"));
        }
        Ok(existed)
    }
    async fn upsert_alias(&self, name: &str, collection: &str) -> Result<()> {
        let mut s = self.state.lock().unwrap();
        assert!(
            !s.collections.contains_key(name),
            "alias {name} shadows a real collection"
        );
        assert!(
            s.collections.contains_key(collection),
            "alias target {collection} missing"
        );
        s.ops.push(format!("alias {name} {collection}"));
        s.aliases.insert(name.to_string(), collection.to_string());
        Ok(())
    }
    async fn import(&self, collection: &str, docs: &[Value]) -> Result<Vec<ImportFailure>> {
        let mut s = self.state.lock().unwrap();
        let target = s
            .aliases
            .get(collection)
            .cloned()
            .unwrap_or_else(|| collection.to_string());
        s.ops.push(format!("import {target} {}", docs.len()));
        let mut failures = Vec::new();
        let coll = s
            .collections
            .get_mut(&target)
            .expect("import into missing collection");
        for doc in docs {
            let id = doc["id"].as_str().unwrap().to_string();
            if doc.get("fail").is_some() {
                failures.push(ImportFailure {
                    id: Some(id),
                    error: "Bad document".into(),
                });
            } else {
                coll.insert(id, doc.clone());
            }
        }
        Ok(failures)
    }
    async fn export_ids(&self, collection: &str) -> Result<HashSet<String>> {
        let mut s = self.state.lock().unwrap();
        s.ops.push(format!("export {collection}"));
        Ok(s.collections[collection].keys().cloned().collect())
    }
}

/// Source rows per collection name, sorted by id.
struct FakeSource {
    rows: HashMap<Source, Vec<(Uuid, Value)>>,
}

fn uuid(n: u128) -> Uuid {
    Uuid::from_u128(n)
}

impl FakeSource {
    /// `counts[i]` rows for `COLLECTIONS[i]`, ids `i*1_000_000 + 1..`.
    fn new(counts: [usize; 7]) -> Self {
        let mut rows = HashMap::new();
        for (index, spec) in COLLECTIONS.iter().enumerate() {
            let list = (1..=counts[index])
                .map(|n| {
                    let id = uuid(index as u128 * 1_000_000 + n as u128);
                    (id, json!({ "id": id.to_string(), "n": n }))
                })
                .collect();
            rows.insert(spec.source, list);
        }
        Self { rows }
    }
    fn mark_failing(&mut self, collection: usize, nth: usize) {
        let list = self.rows.get_mut(&COLLECTIONS[collection].source).unwrap();
        list[nth].1["fail"] = json!(true);
    }
    fn id(&self, collection: usize, nth: usize) -> Uuid {
        self.rows[&COLLECTIONS[collection].source][nth].0
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
}

fn t(h: u32, m: u32, s: u32) -> DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 11, 4, h, m, s).unwrap()
}

const SUFFIX: &str = "20261104030007";
const COUNTS: [usize; 7] = [1200, 3, 2, 1, 0, 4, 2];

fn op_index(ops: &[String], pred: impl Fn(&str) -> bool) -> Vec<usize> {
    ops.iter()
        .enumerate()
        .filter(|(_, o)| pred(o))
        .map(|(i, _)| i)
        .collect()
}

// --- search.reindex ---

#[tokio::test]
async fn full_reindex_swaps_aliases_only_after_every_collection_is_loaded() {
    let backend = FakeBackend::with(
        &[
            ("games_en", 5),                      // legacy real collection
            ("developers_en__20250101000000", 2), // currently aliased
            ("publishers_en__20240101000000", 1), // stale, unaliased
            ("games_tr", 1),                      // legacy Turkish index
        ],
        &[("developers_en", "developers_en__20250101000000")],
    );
    let source = FakeSource::new(COUNTS);
    let io = FakeIo::default();

    let outcome = full::run(&io, &backend, &source, None, t(3, 0, 7))
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Completed);

    let ops = backend.ops();
    let imports = op_index(&ops, |o| o.starts_with("import "));
    let aliases = op_index(&ops, |o| o.starts_with("alias "));
    let creates = op_index(&ops, |o| o.starts_with("create "));
    assert_eq!(aliases.len(), 7);
    assert!(
        imports.iter().max() < aliases.iter().min(),
        "an alias was swapped before all imports: {ops:?}"
    );
    assert!(
        creates.iter().max() < imports.iter().min(),
        "all physical collections exist before indexing"
    );

    // Stale and legacy collections are removed before the new run starts.
    let stale = ops
        .iter()
        .position(|o| o == "delete publishers_en__20240101000000")
        .unwrap();
    assert!(stale < creates[0]);
    assert!(ops.contains(&"delete games_tr".to_string()));

    // The legacy real collection is deleted right before its alias is created.
    let legacy = ops.iter().position(|o| o == "delete games_en").unwrap();
    assert_eq!(
        ops[legacy + 1],
        format!("alias games_en games_en__{SUFFIX}")
    );

    // Previous physical collection is deleted after the swap.
    let previous = ops
        .iter()
        .position(|o| o == "delete developers_en__20250101000000")
        .unwrap();
    assert!(previous > *aliases.iter().max().unwrap());

    for (index, spec) in COLLECTIONS.iter().enumerate() {
        let physical = format!("{}__{SUFFIX}", spec.name);
        assert_eq!(backend.alias(spec.name), Some(physical.clone()));
        assert_eq!(backend.doc_count(&physical), COUNTS[index], "{physical}");
    }
    let mut remaining = backend.collection_names();
    remaining.sort();
    assert!(
        remaining.iter().all(|c| c.ends_with(SUFFIX)),
        "{remaining:?}"
    );

    // Determinate progress: total known up front, reached at the end.
    let total: u64 = COUNTS.iter().sum::<usize>() as u64;
    let last = io.last_progress();
    assert_eq!(last.total, Some(total));
    assert_eq!(last.processed, Some(total));
    assert!(
        io.progress
            .lock()
            .unwrap()
            .iter()
            .filter(|p| p
                .phase
                .as_deref()
                .is_some_and(|ph| ph.starts_with("indexing:")))
            .all(|p| p.total == Some(total))
    );
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
        "swapping aliases",
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
async fn full_reindex_resumes_into_the_same_physical_collections() {
    let backend = FakeBackend::with(&[], &[]);
    let source = FakeSource::new(COUNTS);

    // Checkpoint 1 = after counting, 2 = after the first games batch.
    let first = FakeIo::stopping_after(2, false);
    let outcome = full::run(&first, &backend, &source, None, t(3, 0, 7))
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Interrupted);
    assert!(
        backend.ops().iter().all(|o| !o.starts_with("alias ")),
        "no alias before everything is loaded"
    );

    let cp: FullCheckpoint = serde_json::from_value(first.last_checkpoint()).unwrap();
    assert_eq!(
        cp,
        FullCheckpoint {
            suffix: SUFFIX.into(),
            collection_index: 0,
            last_id: Some(source.id(0, 499))
        }
    );
    assert_eq!(
        first.last_checkpoint(),
        json!({ "suffix": SUFFIX, "collectionIndex": 0, "lastId": source.id(0, 499).to_string() })
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
            .filter(|o| o.starts_with(&format!("import games_en__{SUFFIX}")))
            .count(),
        2
    );
    assert!(
        backend
            .collection_names()
            .iter()
            .all(|c| !c.contains("20261104040000"))
    );
    assert_eq!(
        backend.alias("games_en"),
        Some(format!("games_en__{SUFFIX}"))
    );
    assert_eq!(backend.doc_count(&format!("games_en__{SUFFIX}")), 1200);

    // Resumed progress continues from the processed count.
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
async fn full_reindex_cancel_deletes_half_built_collections() {
    let backend = FakeBackend::with(
        &[("games_en__20250101000000", 3)],
        &[("games_en", "games_en__20250101000000")],
    );
    let source = FakeSource::new(COUNTS);
    let io = FakeIo::stopping_after(2, true);
    let outcome = full::run(&io, &backend, &source, None, t(3, 0, 7))
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Interrupted);
    assert_eq!(
        backend.collection_names(),
        vec!["games_en__20250101000000".to_string()]
    );
    assert_eq!(
        backend.alias("games_en"),
        Some("games_en__20250101000000".into())
    );
    assert_eq!(io.last_checkpoint(), Value::Null);
}

#[tokio::test]
async fn full_reindex_failure_keeps_collections_for_retry() {
    let backend = FakeBackend::with(&[], &[]);
    let mut source = FakeSource::new(COUNTS);
    source.mark_failing(1, 1);
    let io = FakeIo::default();
    let err = full::run(&io, &backend, &source, None, t(3, 0, 7))
        .await
        .unwrap_err();
    assert!(
        err.to_string()
            .contains("developers_en: 1/3 documents failed"),
        "{err}"
    );
    assert!(
        io.logs()
            .iter()
            .any(|l| l.contains("rejected: Bad document"))
    );
    assert_eq!(backend.collection_names().len(), 7);
    assert!(backend.ops().iter().all(|o| !o.starts_with("alias ")));
    let cp: FullCheckpoint = serde_json::from_value(io.last_checkpoint()).unwrap();
    assert_eq!(cp.collection_index, 1);
    assert_eq!(cp.suffix, SUFFIX);
}

#[tokio::test]
async fn full_reindex_rebuilds_a_vanished_collection_on_resume() {
    let backend = FakeBackend::with(&[], &[]);
    let source = FakeSource::new(COUNTS);
    let first = FakeIo::stopping_after(5, false);
    full::run(&first, &backend, &source, None, t(3, 0, 7))
        .await
        .unwrap();
    let cp: FullCheckpoint = serde_json::from_value(first.last_checkpoint()).unwrap();
    assert!(cp.collection_index >= 1);
    backend
        .state
        .lock()
        .unwrap()
        .collections
        .remove(&format!("games_en__{SUFFIX}"));

    let second = FakeIo::default();
    let outcome = full::run(&second, &backend, &source, Some(cp), t(4, 0, 0))
        .await
        .unwrap();
    assert_eq!(outcome, JobOutcome::Completed);
    assert_eq!(backend.doc_count(&format!("games_en__{SUFFIX}")), 1200);
}

#[test]
fn full_checkpoint_serde() {
    let cp = FullCheckpoint {
        suffix: SUFFIX.into(),
        collection_index: 3,
        last_id: None,
    };
    let value = serde_json::to_value(&cp).unwrap();
    assert_eq!(
        value,
        json!({ "suffix": SUFFIX, "collectionIndex": 3, "lastId": null })
    );
    assert_eq!(serde_json::from_value::<FullCheckpoint>(value).unwrap(), cp);
}

// --- search.sync ---

fn all_aliased(backend_docs: &[usize; 7]) -> FakeBackend {
    let physical: Vec<String> = COLLECTIONS
        .iter()
        .map(|c| format!("{}__{SUFFIX}", c.name))
        .collect();
    let collections: Vec<(&str, usize)> = physical
        .iter()
        .zip(backend_docs)
        .map(|(p, n)| (p.as_str(), *n))
        .collect();
    let aliases: Vec<(&str, &str)> = COLLECTIONS
        .iter()
        .zip(&physical)
        .map(|(c, p)| (c.name, p.as_str()))
        .collect();
    FakeBackend::with(&collections, &aliases)
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
            orphans: 1
        }
    );
    assert_eq!(diff(Vec::new(), &HashSet::new()), sync::Diff::default());
}

#[tokio::test]
async fn sync_indexes_only_missing_documents() {
    // One orphan document in games; indexed: games 0..700 of 1200, themes 2 of 4.
    let backend = all_aliased(&[1, 0, 0, 0, 0, 0, 0]);
    let source = FakeSource::new(COUNTS);
    let games = format!("games_en__{SUFFIX}");
    let themes = format!("themes_en__{SUFFIX}");
    for n in 0..700 {
        backend.insert_doc(&games, &source.id(0, n).to_string());
    }
    for n in 0..2 {
        backend.insert_doc(&themes, &source.id(5, n).to_string());
    }
    let expected_missing: u64 = [500, 3, 2, 1, 0, 2, 2].iter().sum();

    let io = FakeIo::default();
    let outcome = sync::run(&io, &backend, &source, None).await.unwrap();
    assert_eq!(outcome, JobOutcome::Completed);

    assert_eq!(backend.doc_count(&games), 1201); // 1200 + the untouched orphan
    assert_eq!(backend.doc_count(&themes), 4);
    let imports: Vec<String> = backend
        .ops()
        .into_iter()
        .filter(|o| o.starts_with("import "))
        .collect();
    assert_eq!(imports[0], format!("import {games} 500"));

    let logs = io.logs();
    assert!(
        logs.iter()
            .any(|l| l.starts_with("games_en: 500 missing, 1 orphaned")),
        "{logs:?}"
    );
    assert!(
        logs.iter()
            .any(|l| l == "games_en: 500 missing, 500 indexed")
    );
    assert!(logs.iter().any(|l| l == "genres_en: 1 missing, 1 indexed"));

    let last = io.last_progress();
    assert_eq!(last.total, Some(expected_missing));
    assert_eq!(last.processed, Some(expected_missing));
    // Diffing happens (and the total is known) before any indexing.
    let ops = backend.ops();
    let exports = op_index(&ops, |o| o.starts_with("export "));
    let first_import = op_index(&ops, |o| o.starts_with("import "))[0];
    assert_eq!(exports.len(), 7);
    assert!(exports.iter().all(|e| *e < first_import));
    assert_eq!(
        serde_json::from_value::<SyncCheckpoint>(io.last_checkpoint())
            .unwrap()
            .collection_index,
        7
    );
}

#[tokio::test]
async fn sync_resume_skips_finished_collections() {
    let backend = all_aliased(&[0; 7]);
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
    assert_eq!(backend.doc_count(&format!("games_en__{SUFFIX}")), 0);
    assert_eq!(backend.doc_count(&format!("themes_en__{SUFFIX}")), 4);
}

#[tokio::test]
async fn sync_accepts_real_collections_and_fails_clearly_when_missing() {
    // Real (non-alias) collections are valid targets.
    let names: Vec<(&str, usize)> = COLLECTIONS.iter().map(|c| (c.name, 0)).collect();
    let backend = FakeBackend::with(&names, &[]);
    let source = FakeSource::new([1, 0, 0, 0, 0, 0, 0]);
    let io = FakeIo::default();
    assert_eq!(
        sync::run(&io, &backend, &source, None).await.unwrap(),
        JobOutcome::Completed
    );
    assert_eq!(backend.doc_count("games_en"), 1);

    // A missing collection fails permanently before any work.
    let backend = FakeBackend::with(&names[..6], &[]);
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
