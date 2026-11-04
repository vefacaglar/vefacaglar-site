//! Search engine operations used by the search jobs, behind a trait so the
//! job logic can be unit-tested against an in-memory fake.

use std::collections::HashSet;
use std::time::Duration;

use anyhow::{Context, Result, anyhow, bail};
use async_trait::async_trait;
use reqwest::{Method, StatusCode};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::config::TypesenseConfig;

/// One rejected document of an import.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportFailure {
    pub id: Option<String>,
    pub error: String,
}

#[async_trait]
pub trait SearchBackend: Send + Sync {
    /// Target collection of alias `name`, or `None` when no such alias exists.
    async fn get_alias(&self, name: &str) -> Result<Option<String>>;
    /// Whether a real collection called `name` exists (aliases do not count).
    async fn collection_exists(&self, name: &str) -> Result<bool>;
    async fn list_collections(&self) -> Result<Vec<String>>;
    /// Creates a collection; an existing one with the same name is accepted.
    async fn create_collection(&self, schema: &Value) -> Result<()>;
    /// Deletes a collection; returns false when it did not exist.
    async fn delete_collection(&self, name: &str) -> Result<bool>;
    async fn upsert_alias(&self, name: &str, collection: &str) -> Result<()>;
    /// JSONL import with `action=upsert`; returns the per-document failures.
    async fn import(&self, collection: &str, docs: &[Value]) -> Result<Vec<ImportFailure>>;
    /// Ids of every document in `collection` (export with `include_fields=id`).
    async fn export_ids(&self, collection: &str) -> Result<HashSet<String>>;
}

/// Typesense over HTTP.
pub struct TypesenseClient {
    http: reqwest::Client,
    base_url: String,
    api_key: String,
}

const ATTEMPTS: u32 = 3;

#[derive(Deserialize)]
struct AliasBody {
    collection_name: String,
}

#[derive(Deserialize)]
struct CollectionBody {
    name: String,
}

#[derive(Deserialize)]
struct ImportLine {
    success: bool,
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    document: Option<String>,
}

#[derive(Deserialize)]
struct IdLine {
    id: String,
}

impl TypesenseClient {
    pub fn new(config: &TypesenseConfig) -> Result<Self> {
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(300))
            .user_agent(concat!("vefacaglar-worker/", env!("CARGO_PKG_VERSION")))
            .build()
            .context("build HTTP client")?;
        Ok(Self {
            http,
            base_url: config.base_url(),
            api_key: config.api_key.clone(),
        })
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    /// Sends an idempotent request, retrying connection errors and 5xx.
    async fn send(
        &self,
        method: Method,
        path: &str,
        body: Option<(&'static str, String)>,
    ) -> Result<reqwest::Response> {
        let mut last_error = None;
        for attempt in 1..=ATTEMPTS {
            let mut request = self
                .http
                .request(method.clone(), self.url(path))
                .header("X-TYPESENSE-API-KEY", &self.api_key);
            if let Some((content_type, body)) = &body {
                request = request
                    .header("Content-Type", *content_type)
                    .body(body.clone());
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

    async fn expect_ok(response: reqwest::Response, what: &str) -> Result<reqwest::Response> {
        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }
        let body = response.text().await.unwrap_or_default();
        bail!("{what}: HTTP {status}: {}", truncate(&body, 300))
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        format!("{}…", s.chars().take(max).collect::<String>())
    }
}

fn encode(segment: &str) -> String {
    // Collection/alias names are `[a-z0-9_]`; encode anything else defensively.
    segment
        .bytes()
        .map(|b| match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'_' | b'-' | b'.' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// Parses an import response body (one JSON result per line, in input order).
pub fn parse_import_response(body: &str, docs: &[Value]) -> Result<Vec<ImportFailure>> {
    let mut failures = Vec::new();
    let mut lines = 0usize;
    for (index, line) in body.lines().filter(|l| !l.trim().is_empty()).enumerate() {
        lines += 1;
        let parsed: ImportLine = serde_json::from_str(line)
            .with_context(|| format!("invalid import result line {}", index + 1))?;
        if !parsed.success {
            let id = docs
                .get(index)
                .and_then(|d| d.get("id"))
                .and_then(Value::as_str)
                .map(str::to_string)
                .or_else(|| {
                    parsed
                        .document
                        .as_deref()
                        .and_then(|d| serde_json::from_str::<Value>(d).ok())
                        .and_then(|v| v.get("id").and_then(Value::as_str).map(str::to_string))
                });
            failures.push(ImportFailure {
                id,
                error: parsed.error.unwrap_or_else(|| "unknown error".to_string()),
            });
        }
    }
    if lines != docs.len() {
        bail!(
            "import returned {lines} results for {} documents",
            docs.len()
        );
    }
    Ok(failures)
}

/// Parses one line of an `include_fields=id` export.
pub fn parse_export_line(line: &str) -> Result<Option<String>> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let parsed: IdLine = serde_json::from_str(trimmed).context("invalid export line")?;
    Ok(Some(parsed.id))
}

#[async_trait]
impl SearchBackend for TypesenseClient {
    async fn get_alias(&self, name: &str) -> Result<Option<String>> {
        let response = self
            .send(Method::GET, &format!("/aliases/{}", encode(name)), None)
            .await?;
        if response.status() == StatusCode::NOT_FOUND {
            return Ok(None);
        }
        let response = Self::expect_ok(response, &format!("get alias {name}")).await?;
        Ok(Some(response.json::<AliasBody>().await?.collection_name))
    }

    async fn collection_exists(&self, name: &str) -> Result<bool> {
        // `GET /collections/{name}` also resolves aliases, so check the list.
        Ok(self.list_collections().await?.iter().any(|c| c == name))
    }

    async fn list_collections(&self) -> Result<Vec<String>> {
        let response = self.send(Method::GET, "/collections", None).await?;
        let response = Self::expect_ok(response, "list collections").await?;
        let collections: Vec<CollectionBody> = response.json().await?;
        Ok(collections.into_iter().map(|c| c.name).collect())
    }

    async fn create_collection(&self, schema: &Value) -> Result<()> {
        let name = schema.get("name").and_then(Value::as_str).unwrap_or("?");
        let response = self
            .send(
                Method::POST,
                "/collections",
                Some(("application/json", schema.to_string())),
            )
            .await?;
        if response.status() == StatusCode::CONFLICT {
            return Ok(());
        }
        Self::expect_ok(response, &format!("create collection {name}")).await?;
        Ok(())
    }

    async fn delete_collection(&self, name: &str) -> Result<bool> {
        let response = self
            .send(
                Method::DELETE,
                &format!("/collections/{}", encode(name)),
                None,
            )
            .await?;
        if response.status() == StatusCode::NOT_FOUND {
            return Ok(false);
        }
        Self::expect_ok(response, &format!("delete collection {name}")).await?;
        Ok(true)
    }

    async fn upsert_alias(&self, name: &str, collection: &str) -> Result<()> {
        let body = json!({ "collection_name": collection }).to_string();
        let response = self
            .send(
                Method::PUT,
                &format!("/aliases/{}", encode(name)),
                Some(("application/json", body)),
            )
            .await?;
        Self::expect_ok(response, &format!("point alias {name} at {collection}")).await?;
        Ok(())
    }

    async fn import(&self, collection: &str, docs: &[Value]) -> Result<Vec<ImportFailure>> {
        if docs.is_empty() {
            return Ok(Vec::new());
        }
        let mut body = String::new();
        for doc in docs {
            body.push_str(&serde_json::to_string(doc)?);
            body.push('\n');
        }
        let path = format!(
            "/collections/{}/documents/import?action=upsert",
            encode(collection)
        );
        let response = self
            .send(Method::POST, &path, Some(("text/plain", body)))
            .await?;
        let response = Self::expect_ok(response, &format!("import into {collection}")).await?;
        let text = response.text().await?;
        parse_import_response(&text, docs)
    }

    async fn export_ids(&self, collection: &str) -> Result<HashSet<String>> {
        let path = format!(
            "/collections/{}/documents/export?include_fields=id",
            encode(collection)
        );
        let response = self.send(Method::GET, &path, None).await?;
        let mut response = Self::expect_ok(response, &format!("export {collection}")).await?;
        // Streamed: only the current partial line is buffered.
        let mut ids = HashSet::new();
        let mut buffer: Vec<u8> = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            buffer.extend_from_slice(&chunk);
            while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
                let line: Vec<u8> = buffer.drain(..=pos).collect();
                if let Some(id) = parse_export_line(std::str::from_utf8(&line)?)? {
                    ids.insert(id);
                }
            }
        }
        if let Some(id) = parse_export_line(std::str::from_utf8(&buffer)?)? {
            ids.insert(id);
        }
        Ok(ids)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn import_response_failures_are_reported_with_ids() {
        let docs = vec![json!({"id": "a"}), json!({"id": "b"}), json!({"id": "c"})];
        let body = "{\"success\":true}\n{\"success\":false,\"error\":\"Bad field\",\"document\":\"{}\"}\n{\"success\":true}\n";
        let failures = parse_import_response(body, &docs).unwrap();
        assert_eq!(
            failures,
            vec![ImportFailure {
                id: Some("b".into()),
                error: "Bad field".into()
            }]
        );
    }

    #[test]
    fn import_response_count_mismatch_is_an_error() {
        let docs = vec![json!({"id": "a"}), json!({"id": "b"})];
        assert!(parse_import_response("{\"success\":true}\n", &docs).is_err());
    }

    #[test]
    fn export_lines() {
        assert_eq!(
            parse_export_line("{\"id\":\"x\"}\n").unwrap(),
            Some("x".to_string())
        );
        assert_eq!(parse_export_line("  ").unwrap(), None);
        assert!(parse_export_line("nope").is_err());
    }
}
