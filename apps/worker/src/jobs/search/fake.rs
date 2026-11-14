//! In-memory Meilisearch fake shared by the search and movie job tests.
//! It mirrors the semantics the jobs rely on: settings stored per index,
//! whole-batch rejection, atomic multi-swaps (rename when the stable index is
//! missing) and a swap history for `was_swapped`.

use std::collections::{BTreeMap, HashSet};
use std::sync::Mutex;

use anyhow::{Result, bail};
use async_trait::async_trait;
use serde_json::{Value, json};

use super::backend::SearchBackend;

#[derive(Debug, Clone, Default)]
pub struct FakeIndex {
    pub settings: Value,
    pub docs: BTreeMap<String, Value>,
}

#[derive(Default)]
pub struct MeiliState {
    pub indexes: BTreeMap<String, FakeIndex>,
    /// Succeeded swap tasks, each a list of `(build, stable)` pairs.
    pub swaps: Vec<Vec<(String, String)>>,
    pub ops: Vec<String>,
    /// The next add fails (whole batch) when set.
    pub fail_next_add: bool,
    /// The next swap succeeds but its reply is lost (simulated crash).
    pub crash_after_swap: bool,
    pub adds: usize,
    pub document_deletions: usize,
    pub deleted_indexes: Vec<String>,
}

#[derive(Default)]
pub struct FakeMeili {
    pub state: Mutex<MeiliState>,
}

impl FakeMeili {
    /// Indexes with `n` placeholder documents each and the given settings.
    pub fn with(indexes: &[(&str, usize, Value)]) -> Self {
        let fake = Self::default();
        {
            let mut s = fake.state.lock().unwrap();
            for (name, docs, settings) in indexes {
                let mut index = FakeIndex {
                    settings: settings.clone(),
                    ..Default::default()
                };
                for i in 0..*docs {
                    let id = format!("orphan-{i}");
                    index.docs.insert(id.clone(), json!({ "id": id }));
                }
                s.indexes.insert(name.to_string(), index);
            }
        }
        fake
    }
    pub fn ops(&self) -> Vec<String> {
        self.state.lock().unwrap().ops.clone()
    }
    pub fn names(&self) -> Vec<String> {
        self.state.lock().unwrap().indexes.keys().cloned().collect()
    }
    pub fn exists(&self, name: &str) -> bool {
        self.state.lock().unwrap().indexes.contains_key(name)
    }
    pub fn doc_count(&self, name: &str) -> usize {
        self.state
            .lock()
            .unwrap()
            .indexes
            .get(name)
            .map_or(0, |index| index.docs.len())
    }
    pub fn doc(&self, name: &str, id: &str) -> Option<Value> {
        self.state.lock().unwrap().indexes[name]
            .docs
            .get(id)
            .cloned()
    }
    pub fn insert_doc(&self, name: &str, id: &str) {
        self.state
            .lock()
            .unwrap()
            .indexes
            .get_mut(name)
            .unwrap()
            .docs
            .insert(id.to_string(), json!({ "id": id }));
    }
}

#[async_trait]
impl SearchBackend for FakeMeili {
    async fn index_exists(&self, uid: &str) -> Result<bool> {
        Ok(self.exists(uid))
    }
    async fn list_indexes(&self) -> Result<Vec<String>> {
        Ok(self.names())
    }
    async fn settings(&self, uid: &str) -> Result<Option<Value>> {
        Ok(self
            .state
            .lock()
            .unwrap()
            .indexes
            .get(uid)
            .map(|index| index.settings.clone()))
    }
    async fn create_index(&self, uid: &str, settings: &Value) -> Result<()> {
        let mut s = self.state.lock().unwrap();
        s.ops.push(format!("create {uid}"));
        s.indexes.entry(uid.to_string()).or_default().settings = settings.clone();
        Ok(())
    }
    async fn delete_index(&self, uid: &str) -> Result<bool> {
        let mut s = self.state.lock().unwrap();
        let existed = s.indexes.remove(uid).is_some();
        if existed {
            s.ops.push(format!("delete {uid}"));
            s.deleted_indexes.push(uid.to_string());
        }
        Ok(existed)
    }
    async fn swap_indexes(&self, pairs: &[(&str, &str)]) -> Result<()> {
        let mut s = self.state.lock().unwrap();
        if let Some((_, build)) = pairs.iter().find(|(_, b)| !s.indexes.contains_key(*b)) {
            bail!("index_not_found: {build}");
        }
        for (stable, build) in pairs {
            let built = s.indexes.remove(*build).unwrap();
            if let Some(old) = s.indexes.remove(*stable) {
                s.indexes.insert(build.to_string(), old);
            }
            s.indexes.insert(stable.to_string(), built);
        }
        s.ops.push(format!(
            "swap {}",
            pairs
                .iter()
                .map(|(stable, build)| format!("{stable}<-{build}"))
                .collect::<Vec<_>>()
                .join(",")
        ));
        let record = pairs
            .iter()
            .map(|(stable, build)| (build.to_string(), stable.to_string()))
            .collect();
        s.swaps.push(record);
        if s.crash_after_swap {
            s.crash_after_swap = false;
            bail!("simulated crash after the swap task succeeded");
        }
        Ok(())
    }
    async fn was_swapped(&self, uid: &str) -> Result<bool> {
        Ok(self
            .state
            .lock()
            .unwrap()
            .swaps
            .iter()
            .flatten()
            .any(|(build, stable)| build == uid || stable == uid))
    }
    async fn add_documents(&self, uid: &str, docs: &[Value]) -> Result<()> {
        if docs.is_empty() {
            return Ok(());
        }
        let mut s = self.state.lock().unwrap();
        s.ops.push(format!("add {uid} {}", docs.len()));
        if s.fail_next_add || docs.iter().any(|doc| doc.get("fail").is_some()) {
            s.fail_next_add = false;
            bail!("Meilisearch task failed (invalid_document_fields): Bad document");
        }
        s.adds += 1;
        let Some(index) = s.indexes.get_mut(uid) else {
            bail!("add into missing index {uid}");
        };
        for doc in docs {
            let id = doc["id"].as_str().unwrap().to_string();
            index.docs.insert(id, doc.clone());
        }
        Ok(())
    }
    async fn delete_documents(&self, uid: &str, ids: &[String]) -> Result<()> {
        if ids.is_empty() {
            return Ok(());
        }
        let mut s = self.state.lock().unwrap();
        s.document_deletions += ids.len();
        let Some(index) = s.indexes.get_mut(uid) else {
            bail!("delete from missing index {uid}");
        };
        for id in ids {
            index.docs.remove(id);
        }
        Ok(())
    }
    async fn document_ids(&self, uid: &str) -> Result<HashSet<String>> {
        let mut s = self.state.lock().unwrap();
        s.ops.push(format!("ids {uid}"));
        Ok(s.indexes[uid].docs.keys().cloned().collect())
    }
}
