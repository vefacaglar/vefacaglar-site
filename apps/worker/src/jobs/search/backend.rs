//! Search engine operations used by the search jobs, behind a trait so the
//! job logic can be unit-tested against an in-memory fake.
//!
//! Meilisearch processes writes asynchronously: every write returns a task,
//! and the client waits for that task to finish so callers only checkpoint
//! durable work. Stable index uids (e.g. `games_en`) are what the API queries;
//! rebuilds load a temporary index and atomically swap it in.

use std::collections::HashSet;
use std::time::{Duration, Instant};

use anyhow::{Context, Result, anyhow, bail};
use async_trait::async_trait;
use reqwest::{Method, StatusCode};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::config::MeilisearchConfig;

/// Primary key of every search index.
pub const PRIMARY_KEY: &str = "id";

#[async_trait]
pub trait SearchBackend: Send + Sync {
    async fn index_exists(&self, uid: &str) -> Result<bool>;
    async fn list_indexes(&self) -> Result<Vec<String>>;
    /// Full settings of `uid`, or `None` when the index does not exist.
    async fn settings(&self, uid: &str) -> Result<Option<Value>>;
    /// Creates `uid` (primary key `id`) when missing and applies `settings`.
    async fn create_index(&self, uid: &str, settings: &Value) -> Result<()>;
    /// Deletes an index; returns false when it did not exist.
    async fn delete_index(&self, uid: &str) -> Result<bool>;
    /// Atomically swaps every `(stable, build)` pair in one task. A missing
    /// stable index is created by renaming its build index.
    async fn swap_indexes(&self, pairs: &[(&str, &str)]) -> Result<()>;
    /// Whether `uid` took part in a succeeded swap (waits for an in-flight
    /// one). Build uids are unique and swapped at most once, so this tells a
    /// crash-resumed publish whether its swap already happened.
    async fn was_swapped(&self, uid: &str) -> Result<bool>;
    /// Adds or replaces documents. The whole batch fails when one is invalid.
    async fn add_documents(&self, uid: &str, docs: &[Value]) -> Result<()>;
    /// Deletes documents by id; absent documents are ignored.
    async fn delete_documents(&self, uid: &str, ids: &[String]) -> Result<()>;
    /// Ids of every document in `uid`.
    async fn document_ids(&self, uid: &str) -> Result<HashSet<String>>;
}

/// True when every key of `expected` has the same value in `actual`
/// (recursively for objects). Meilisearch returns every setting with its
/// default, so only the keys the contract sets are compared. Filterable and
/// sortable attributes are sets (Meilisearch returns them sorted), so their
/// order is ignored; every other list (searchable attributes, ranking rules)
/// is ordered.
pub fn settings_match(actual: &Value, expected: &Value) -> bool {
    match (actual, expected) {
        (Value::Object(actual), Value::Object(expected)) => expected.iter().all(|(key, value)| {
            actual.get(key).is_some_and(|candidate| {
                if UNORDERED_SETTINGS.contains(&key.as_str()) {
                    same_set(candidate, value)
                } else {
                    settings_match(candidate, value)
                }
            })
        }),
        _ => actual == expected,
    }
}

const UNORDERED_SETTINGS: [&str; 2] = ["filterableAttributes", "sortableAttributes"];

fn same_set(actual: &Value, expected: &Value) -> bool {
    match (actual.as_array(), expected.as_array()) {
        (Some(actual), Some(expected)) => {
            actual.len() == expected.len() && expected.iter().all(|value| actual.contains(value))
        }
        _ => actual == expected,
    }
}

/// Meilisearch over HTTP.
pub struct MeilisearchClient {
    http: reqwest::Client,
    base_url: String,
    api_key: String,
    task_timeout: Duration,
}

const ATTEMPTS: u32 = 3;
const DOCUMENT_PAGE: usize = 10_000;

/// A non-success HTTP reply.
#[derive(Debug, thiserror::Error)]
#[error("{operation}: HTTP {status}: {body}")]
pub(crate) struct MeilisearchReplyError {
    pub(crate) status: StatusCode,
    operation: String,
    body: String,
    pub(crate) code: Option<String>,
    server_message: Option<String>,
}

impl MeilisearchReplyError {
    pub(crate) fn diagnostic(&self) -> String {
        let summary = format!(
            "Meilisearch {} returned HTTP {}",
            self.operation, self.status
        );
        match (self.code.as_deref(), self.server_message.as_deref()) {
            (Some(code), Some(message)) => format!("{summary} ({code}): {message}"),
            (None, Some(message)) => format!("{summary}: {message}"),
            _ => summary,
        }
    }
}

/// An enqueued task that finished as failed or canceled.
#[derive(Debug, thiserror::Error)]
#[error("{operation}: Meilisearch task {task_uid} {status}: {code}: {message}")]
pub(crate) struct MeilisearchTaskError {
    operation: String,
    task_uid: u64,
    status: String,
    pub(crate) code: String,
    message: String,
}

impl MeilisearchTaskError {
    pub(crate) fn diagnostic(&self) -> String {
        format!(
            "Meilisearch task for {} {} ({}): {}",
            self.operation, self.status, self.code, self.message
        )
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Enqueued {
    task_uid: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Task {
    pub(crate) uid: u64,
    pub(crate) status: String,
    #[serde(default)]
    pub(crate) error: Option<TaskErrorBody>,
    #[serde(default)]
    pub(crate) details: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct TaskErrorBody {
    #[serde(default)]
    pub(crate) code: String,
    #[serde(default)]
    pub(crate) message: String,
}

#[derive(Deserialize)]
struct TaskPage {
    results: Vec<Task>,
    #[serde(default)]
    next: Option<u64>,
}

#[derive(Deserialize)]
struct IndexPage {
    results: Vec<IndexBody>,
    total: usize,
}

#[derive(Deserialize)]
struct IndexBody {
    uid: String,
}

#[derive(Deserialize)]
struct DocumentPage {
    results: Vec<IdOnly>,
    total: usize,
}

#[derive(Deserialize)]
struct IdOnly {
    id: Value,
}

impl MeilisearchClient {
    pub fn new(config: &MeilisearchConfig) -> Result<Self> {
        Self::with_timeouts(config, Duration::from_secs(120), Duration::from_secs(600))
    }

    /// `request` bounds one HTTP request; `task` bounds waiting for a task.
    pub fn with_timeouts(
        config: &MeilisearchConfig,
        request: Duration,
        task: Duration,
    ) -> Result<Self> {
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(request)
            .user_agent(concat!("vefacaglar-worker/", env!("CARGO_PKG_VERSION")))
            .build()
            .context("build HTTP client")?;
        Ok(Self {
            http,
            base_url: config.url.clone(),
            api_key: config.api_key.clone(),
            task_timeout: task,
        })
    }

    /// Sends a request, retrying connection errors and 5xx. Only used for
    /// reads and for writes whose retry is harmless (Meilisearch writes are
    /// idempotent upserts/deletes; a duplicate swap is never retried blindly,
    /// see [`SearchBackend::was_swapped`]).
    async fn send(
        &self,
        method: Method,
        path: &str,
        body: Option<&Value>,
    ) -> Result<reqwest::Response> {
        let mut last_error = None;
        for attempt in 1..=ATTEMPTS {
            let mut request = self
                .http
                .request(method.clone(), format!("{}{}", self.base_url, path));
            if !self.api_key.is_empty() {
                request = request.bearer_auth(&self.api_key);
            }
            if let Some(body) = body {
                request = request.json(body);
            }
            match request.send().await {
                Ok(response) if response.status().is_server_error() && attempt < ATTEMPTS => {
                    last_error = Some(anyhow!("{method} {path}: HTTP {}", response.status()));
                }
                Ok(response) => return Ok(response),
                Err(e) if (e.is_connect() || e.is_timeout()) && attempt < ATTEMPTS => {
                    last_error = Some(anyhow!(e).context(format!("{method} {path}")));
                }
                Err(e) => return Err(anyhow!(e).context(format!("{method} {path}"))),
            }
            tokio::time::sleep(Duration::from_millis(500 * u64::from(attempt))).await;
        }
        Err(last_error.unwrap_or_else(|| anyhow!("{method} {path} failed")))
    }

    async fn reply_error(response: reqwest::Response, what: &str) -> anyhow::Error {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        let parsed = serde_json::from_str::<Value>(&body).ok();
        let field = |name: &str| {
            parsed
                .as_ref()
                .and_then(|body| body.get(name))
                .and_then(Value::as_str)
                .map(str::to_owned)
        };
        MeilisearchReplyError {
            status,
            operation: what.to_owned(),
            body: truncate(&body, 300),
            code: field("code"),
            server_message: field("message"),
        }
        .into()
    }

    async fn expect_ok(response: reqwest::Response, what: &str) -> Result<reqwest::Response> {
        if response.status().is_success() {
            Ok(response)
        } else {
            Err(Self::reply_error(response, what).await)
        }
    }

    /// Sends a write and returns its finished task (succeeded or failed).
    async fn write(
        &self,
        method: Method,
        path: &str,
        body: Option<&Value>,
        what: &str,
    ) -> Result<Task> {
        let response = self.send(method, path, body).await?;
        let response = Self::expect_ok(response, what).await?;
        let enqueued: Enqueued = response.json().await.context("decode enqueued task")?;
        self.wait(enqueued.task_uid, what).await
    }

    /// Sends a write that must succeed.
    async fn write_ok(
        &self,
        method: Method,
        path: &str,
        body: Option<&Value>,
        what: &str,
    ) -> Result<()> {
        let task = self.write(method, path, body, what).await?;
        task_result(task, what)
    }

    /// Polls a task until it is finished, with a bounded total wait.
    async fn wait(&self, task_uid: u64, what: &str) -> Result<Task> {
        let deadline = Instant::now() + self.task_timeout;
        let mut delay = Duration::from_millis(25);
        loop {
            let response = self
                .send(Method::GET, &format!("/tasks/{task_uid}"), None)
                .await?;
            let response = Self::expect_ok(response, &format!("get task {task_uid}")).await?;
            let task: Task = response.json().await.context("decode task")?;
            if matches!(task.status.as_str(), "succeeded" | "failed" | "canceled") {
                return Ok(task);
            }
            if Instant::now() >= deadline {
                bail!(
                    "{what}: Meilisearch task {task_uid} still {} after {}s",
                    task.status,
                    self.task_timeout.as_secs()
                );
            }
            tokio::time::sleep(delay).await;
            delay = (delay * 2).min(Duration::from_secs(1));
        }
    }
}

/// Maps a finished task to `Ok` or a [`MeilisearchTaskError`].
pub(crate) fn task_result(task: Task, what: &str) -> Result<()> {
    if task.status == "succeeded" {
        return Ok(());
    }
    let (code, message) = task
        .error
        .map(|error| (error.code, error.message))
        .unwrap_or_else(|| ("unknown".into(), "no error details".into()));
    Err(MeilisearchTaskError {
        operation: what.to_owned(),
        task_uid: task.uid,
        status: task.status,
        code,
        message: truncate(&message, 300),
    }
    .into())
}

fn task_failed_with(task: &Task, code: &str) -> bool {
    task.status == "failed" && task.error.as_ref().is_some_and(|e| e.code == code)
}

/// Whether a swap task's `details.swaps` names `uid`.
pub(crate) fn swap_involves(task: &Task, uid: &str) -> bool {
    task.details
        .as_ref()
        .and_then(|details| details.get("swaps"))
        .and_then(Value::as_array)
        .is_some_and(|swaps| {
            swaps.iter().any(|swap| {
                swap.get("indexes")
                    .and_then(Value::as_array)
                    .is_some_and(|indexes| indexes.iter().any(|index| index == uid))
            })
        })
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        format!("{}…", s.chars().take(max).collect::<String>())
    }
}

fn encode(segment: &str) -> String {
    // Index uids and document ids are `[A-Za-z0-9_-]`; encode anything else.
    segment
        .bytes()
        .map(|b| match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'_' | b'-' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

fn id_string(id: &Value) -> Option<String> {
    match id {
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

#[async_trait]
impl SearchBackend for MeilisearchClient {
    async fn index_exists(&self, uid: &str) -> Result<bool> {
        let response = self
            .send(Method::GET, &format!("/indexes/{}", encode(uid)), None)
            .await?;
        if response.status() == StatusCode::NOT_FOUND {
            return Ok(false);
        }
        Self::expect_ok(response, &format!("get index {uid}")).await?;
        Ok(true)
    }

    async fn list_indexes(&self) -> Result<Vec<String>> {
        let mut names = Vec::new();
        loop {
            let path = format!("/indexes?limit=1000&offset={}", names.len());
            let response = self.send(Method::GET, &path, None).await?;
            let response = Self::expect_ok(response, "list indexes").await?;
            let page: IndexPage = response.json().await.context("decode index list")?;
            let len = page.results.len();
            names.extend(page.results.into_iter().map(|index| index.uid));
            if len == 0 || names.len() >= page.total {
                return Ok(names);
            }
        }
    }

    async fn settings(&self, uid: &str) -> Result<Option<Value>> {
        let response = self
            .send(
                Method::GET,
                &format!("/indexes/{}/settings", encode(uid)),
                None,
            )
            .await?;
        if response.status() == StatusCode::NOT_FOUND {
            return Ok(None);
        }
        let response = Self::expect_ok(response, &format!("get settings of {uid}")).await?;
        Ok(Some(response.json().await.context("decode settings")?))
    }

    async fn create_index(&self, uid: &str, settings: &Value) -> Result<()> {
        let what = format!("create index {uid}");
        let body = json!({ "uid": uid, "primaryKey": PRIMARY_KEY });
        let task = self
            .write(Method::POST, "/indexes", Some(&body), &what)
            .await?;
        if !task_failed_with(&task, "index_already_exists") {
            task_result(task, &what)?;
        }
        self.write_ok(
            Method::PATCH,
            &format!("/indexes/{}/settings", encode(uid)),
            Some(settings),
            &format!("update settings of {uid}"),
        )
        .await
    }

    async fn delete_index(&self, uid: &str) -> Result<bool> {
        let what = format!("delete index {uid}");
        let response = self
            .send(Method::DELETE, &format!("/indexes/{}", encode(uid)), None)
            .await?;
        if response.status() == StatusCode::NOT_FOUND {
            return Ok(false);
        }
        let response = Self::expect_ok(response, &what).await?;
        let enqueued: Enqueued = response.json().await.context("decode enqueued task")?;
        let task = self.wait(enqueued.task_uid, &what).await?;
        if task_failed_with(&task, "index_not_found") {
            return Ok(false);
        }
        task_result(task, &what)?;
        Ok(true)
    }

    async fn swap_indexes(&self, pairs: &[(&str, &str)]) -> Result<()> {
        if pairs.is_empty() {
            return Ok(());
        }
        let mut body = Vec::with_capacity(pairs.len());
        for (stable, build) in pairs {
            // `rename` turns the build index into the stable one when the
            // stable index does not exist yet (first build, lost volume).
            let rename = !self.index_exists(stable).await?;
            body.push(json!({ "indexes": [build, stable], "rename": rename }));
        }
        let what = format!(
            "swap {}",
            pairs
                .iter()
                .map(|(stable, build)| format!("{build} -> {stable}"))
                .collect::<Vec<_>>()
                .join(", ")
        );
        // Not retried blindly: a swap is its own inverse.
        let request = self
            .http
            .post(format!("{}/swap-indexes", self.base_url))
            .json(&Value::Array(body));
        let request = if self.api_key.is_empty() {
            request
        } else {
            request.bearer_auth(&self.api_key)
        };
        let response = request
            .send()
            .await
            .map_err(|e| anyhow!(e).context(format!("POST /swap-indexes ({what})")))?;
        let response = Self::expect_ok(response, &what).await?;
        let enqueued: Enqueued = response.json().await.context("decode enqueued task")?;
        let task = self.wait(enqueued.task_uid, &what).await?;
        task_result(task, &what)
    }

    async fn was_swapped(&self, uid: &str) -> Result<bool> {
        let deadline = Instant::now() + self.task_timeout;
        'scan: loop {
            let mut from: Option<u64> = None;
            loop {
                let mut path = "/tasks?types=indexSwap&limit=200".to_string();
                if let Some(from) = from {
                    path.push_str(&format!("&from={from}"));
                }
                let response = self.send(Method::GET, &path, None).await?;
                let response = Self::expect_ok(response, "list swap tasks").await?;
                let page: TaskPage = response.json().await.context("decode task list")?;
                for task in page.results.iter().filter(|task| swap_involves(task, uid)) {
                    match task.status.as_str() {
                        "succeeded" => return Ok(true),
                        "enqueued" | "processing" => {
                            if Instant::now() >= deadline {
                                bail!("swap task {} for {uid} is still {}", task.uid, task.status);
                            }
                            tokio::time::sleep(Duration::from_millis(250)).await;
                            continue 'scan;
                        }
                        _ => {}
                    }
                }
                match page.next {
                    Some(next) => from = Some(next),
                    None => return Ok(false),
                }
            }
        }
    }

    async fn add_documents(&self, uid: &str, docs: &[Value]) -> Result<()> {
        if docs.is_empty() {
            return Ok(());
        }
        self.write_ok(
            Method::POST,
            &format!(
                "/indexes/{}/documents?primaryKey={PRIMARY_KEY}",
                encode(uid)
            ),
            Some(&Value::Array(docs.to_vec())),
            &format!("add documents to {uid}"),
        )
        .await
    }

    async fn delete_documents(&self, uid: &str, ids: &[String]) -> Result<()> {
        if ids.is_empty() {
            return Ok(());
        }
        self.write_ok(
            Method::POST,
            &format!("/indexes/{}/documents/delete-batch", encode(uid)),
            Some(&json!(ids)),
            &format!("delete documents from {uid}"),
        )
        .await
    }

    async fn document_ids(&self, uid: &str) -> Result<HashSet<String>> {
        let mut ids = HashSet::new();
        let mut offset = 0usize;
        loop {
            let body = json!({ "fields": [PRIMARY_KEY], "limit": DOCUMENT_PAGE, "offset": offset });
            let response = self
                .send(
                    Method::POST,
                    &format!("/indexes/{}/documents/fetch", encode(uid)),
                    Some(&body),
                )
                .await?;
            let response = Self::expect_ok(response, &format!("fetch ids of {uid}")).await?;
            let page: DocumentPage = response.json().await.context("decode documents")?;
            let len = page.results.len();
            for doc in page.results {
                ids.insert(id_string(&doc.id).context("document id is not a string")?);
            }
            offset += len;
            if len == 0 || offset >= page.total {
                return Ok(ids);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_match_compares_only_contract_keys() {
        let actual = json!({
            "searchableAttributes": ["name"],
            "rankingRules": ["words", "typo"],
            "pagination": { "maxTotalHits": 1000 },
            "typoTolerance": { "enabled": true }
        });
        assert!(settings_match(
            &actual,
            &json!({ "searchableAttributes": ["name"], "pagination": { "maxTotalHits": 1000 } })
        ));
        assert!(!settings_match(
            &actual,
            &json!({ "pagination": { "maxTotalHits": 5000 } })
        ));
        assert!(!settings_match(
            &actual,
            &json!({ "searchableAttributes": ["name", "slug"] })
        ));
        assert!(!settings_match(
            &actual,
            &json!({ "sortableAttributes": [] })
        ));
    }

    #[test]
    fn settings_match_ignores_the_order_of_attribute_sets() {
        let actual = json!({
            "sortableAttributes": ["createdAt", "popularityScore"],
            "rankingRules": ["typo", "words"]
        });
        assert!(settings_match(
            &actual,
            &json!({ "sortableAttributes": ["popularityScore", "createdAt"] })
        ));
        assert!(!settings_match(
            &actual,
            &json!({ "sortableAttributes": ["popularityScore"] })
        ));
        assert!(!settings_match(
            &actual,
            &json!({ "rankingRules": ["words", "typo"] })
        ));
    }

    #[test]
    fn failed_tasks_carry_the_meilisearch_code() {
        let task = Task {
            uid: 7,
            status: "failed".into(),
            error: Some(TaskErrorBody {
                code: "invalid_document_id".into(),
                message: "Document identifier `a b` is invalid.".into(),
            }),
            details: None,
        };
        let error = task_result(task, "add documents to games_en").unwrap_err();
        let reply = error.downcast_ref::<MeilisearchTaskError>().unwrap();
        assert_eq!(reply.code, "invalid_document_id");
        assert!(
            reply
                .diagnostic()
                .contains("add documents to games_en failed")
        );
    }

    #[test]
    fn swap_tasks_are_matched_by_index_uid() {
        let task = Task {
            uid: 3,
            status: "succeeded".into(),
            error: None,
            details: Some(json!({ "swaps": [{ "indexes": ["a__build_1", "a"], "rename": true }] })),
        };
        assert!(swap_involves(&task, "a__build_1"));
        assert!(!swap_involves(&task, "a__build_2"));
    }

    #[test]
    fn path_segments_are_encoded() {
        assert_eq!(encode("games_en__build_1"), "games_en__build_1");
        assert_eq!(encode("a/b c"), "a%2Fb%20c");
    }
}
