//! `search.reindex`: full rebuild with a zero-downtime alias swap.
//!
//! 1. Fresh run: delete stale `{alias}__*` collections no alias points to (and
//!    legacy `*_tr` collections), pick one run suffix and create a physical
//!    `{alias}__{suffix}` collection for every alias.
//! 2. Index every source into its physical collection (keyset batches,
//!    checkpoint `{suffix, collectionIndex, lastId}` after every batch, so a
//!    resumed run continues into the SAME physical collections).
//! 3. Only after ALL collections are loaded, point every alias at its new
//!    collection (a legacy real collection with the alias name is deleted
//!    right before its alias is created).
//! 4. Delete the previously aliased collections.
//!
//! Cancel deletes the half-built collections; failures keep them for retry.

use std::collections::HashSet;

use anyhow::{Result, bail};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use super::backend::SearchBackend;
use super::collections::{
    COLLECTIONS, is_physical_of, legacy_collections, physical_name, run_suffix, schema,
};
use super::source::SourceData;
use super::{BATCH_SIZE, LOG_EVERY_BATCHES, import_batch};
use crate::context::{JobIo, Progress};
use crate::handler::JobOutcome;
use crate::queue::LogLevel;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullCheckpoint {
    /// Suffix of this run's physical collections (`yyyymmddhhmmss`).
    pub suffix: String,
    /// Index into [`COLLECTIONS`] being indexed; `COLLECTIONS.len()` = all loaded.
    pub collection_index: usize,
    /// Last indexed primary key within the current collection.
    pub last_id: Option<Uuid>,
}

fn is_valid_suffix(s: &str) -> bool {
    s.len() == 14 && s.bytes().all(|b| b.is_ascii_digit())
}

pub async fn run(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    source: &dyn SourceData,
    checkpoint: Option<FullCheckpoint>,
    now: DateTime<Utc>,
) -> Result<JobOutcome> {
    if io.should_stop() {
        return Ok(JobOutcome::Interrupted);
    }
    let mut progress = Progress {
        phase: Some("preparing".into()),
        message: Some("preparing collections".into()),
        ..Default::default()
    };
    io.progress(&progress).await?;

    let checkpoint = checkpoint
        .filter(|c| is_valid_suffix(&c.suffix) && c.collection_index <= COLLECTIONS.len());
    let fresh = checkpoint.is_none();
    let mut cp = checkpoint.unwrap_or_else(|| FullCheckpoint {
        suffix: run_suffix(now),
        collection_index: 0,
        last_id: None,
    });

    if fresh {
        progress.phase = Some("cleanup".into());
        progress.message = Some("removing stale collections".into());
        io.progress(&progress).await?;
        delete_stale(io, backend, None).await?;
        for legacy in legacy_collections() {
            if backend.collection_exists(&legacy).await?
                && backend.delete_collection(&legacy).await?
            {
                io.log(
                    LogLevel::Warn,
                    &format!("deleted legacy collection {legacy}"),
                )
                .await;
            }
        }
        io.log(
            LogLevel::Info,
            &format!("full reindex started (run suffix {})", cp.suffix),
        )
        .await;
    } else {
        io.log(
            LogLevel::Info,
            &format!(
                "resuming full reindex (run suffix {}) at {} after {}",
                cp.suffix,
                COLLECTIONS
                    .get(cp.collection_index)
                    .map_or("alias swap", |c| c.name),
                cp.last_id
                    .map_or_else(|| "start".to_string(), |id| id.to_string())
            ),
        )
        .await;
    }

    // Every physical collection of this run must exist; a loaded one that
    // vanished is rebuilt from scratch.
    let existing: HashSet<String> = backend.list_collections().await?.into_iter().collect();
    for (index, spec) in COLLECTIONS.iter().enumerate() {
        let physical = physical_name(spec.name, &cp.suffix);
        if existing.contains(&physical) {
            continue;
        }
        backend.create_collection(&schema(spec, &physical)).await?;
        let lost_data =
            index < cp.collection_index || (index == cp.collection_index && cp.last_id.is_some());
        if !fresh && lost_data {
            io.log(
                LogLevel::Warn,
                &format!(
                    "collection {physical} was missing; re-indexing from {}",
                    spec.name
                ),
            )
            .await;
            cp.collection_index = index;
            cp.last_id = None;
        }
    }

    // Counts up front for a determinate progress bar.
    progress.phase = Some("counting".into());
    progress.message = Some("counting source rows".into());
    io.progress(&progress).await?;
    let mut counts = Vec::with_capacity(COLLECTIONS.len());
    for spec in COLLECTIONS.iter() {
        counts.push(source.count(spec.source, None).await?);
    }
    let total: u64 = counts.iter().sum();
    let mut processed: u64 = counts[..cp.collection_index.min(COLLECTIONS.len())]
        .iter()
        .sum();
    if let (Some(last_id), Some(spec)) = (cp.last_id, COLLECTIONS.get(cp.collection_index)) {
        processed += source.count(spec.source, Some(last_id)).await?;
    }
    progress.total = Some(total.max(processed));
    progress.processed = Some(processed);
    io.checkpoint(&progress, serde_json::to_value(&cp)?).await?;
    io.log(
        LogLevel::Info,
        &format!(
            "{total} documents to index: {}",
            COLLECTIONS
                .iter()
                .zip(&counts)
                .map(|(c, n)| format!("{} {n}", c.name))
                .collect::<Vec<_>>()
                .join(", ")
        ),
    )
    .await;

    // Index.
    while cp.collection_index < COLLECTIONS.len() {
        if io.should_stop() {
            return interrupted(io, backend, &cp, &progress).await;
        }
        let spec = &COLLECTIONS[cp.collection_index];
        let physical = physical_name(spec.name, &cp.suffix);
        let count = counts[cp.collection_index];
        let mut in_collection = match cp.last_id {
            Some(last_id) => source.count(spec.source, Some(last_id)).await?,
            None => 0,
        };
        if cp.last_id.is_none() {
            io.log(
                LogLevel::Info,
                &format!("{}: indexing {count} documents into {physical}", spec.name),
            )
            .await;
        }
        let phase = format!("indexing:{}", spec.name);
        let mut batches: u64 = 0;
        loop {
            let page = source
                .docs_page(spec.source, cp.last_id, BATCH_SIZE)
                .await?;
            if page.docs.is_empty() {
                break;
            }
            import_batch(io, backend, &physical, spec.name, &page.docs).await?;
            let n = page.docs.len() as u64;
            processed += n;
            in_collection += n;
            batches += 1;
            cp.last_id = page.last_id;
            progress.phase = Some(phase.clone());
            progress.processed = Some(processed);
            progress.total = Some(total.max(processed));
            progress.message = Some(format!("{}: {in_collection}/{count}", spec.name));
            io.checkpoint(&progress, serde_json::to_value(&cp)?).await?;
            if batches.is_multiple_of(LOG_EVERY_BATCHES) {
                io.log(
                    LogLevel::Info,
                    &format!("{}: {in_collection}/{count} indexed", spec.name),
                )
                .await;
            }
            if (page.docs.len()) < BATCH_SIZE {
                break;
            }
            if io.should_stop() {
                return interrupted(io, backend, &cp, &progress).await;
            }
        }
        io.log(
            LogLevel::Info,
            &format!("{}: {in_collection} documents indexed", spec.name),
        )
        .await;
        cp.collection_index += 1;
        cp.last_id = None;
        io.checkpoint(&progress, serde_json::to_value(&cp)?).await?;
    }

    // Swap every alias only now that every collection is fully loaded. No
    // stop checks from here on: the remaining steps are quick and idempotent.
    progress.phase = Some("swapping aliases".into());
    progress.message = Some("pointing aliases at the new collections".into());
    io.progress(&progress).await?;
    let mut previous = Vec::new();
    for spec in COLLECTIONS.iter() {
        let physical = physical_name(spec.name, &cp.suffix);
        let old = backend.get_alias(spec.name).await?;
        if old.is_none() && backend.collection_exists(spec.name).await? {
            io.log(
                LogLevel::Warn,
                &format!(
                    "deleting legacy real collection {} to replace it with an alias (brief search gap)",
                    spec.name
                ),
            )
            .await;
            backend.delete_collection(spec.name).await?;
        }
        backend.upsert_alias(spec.name, &physical).await?;
        io.log(
            LogLevel::Info,
            &format!(
                "alias {} -> {physical}{}",
                spec.name,
                old.as_deref()
                    .map_or(String::new(), |o| format!(" (was {o})"))
            ),
        )
        .await;
        if let Some(old) = old.filter(|o| *o != physical) {
            previous.push(old);
        }
    }

    progress.phase = Some("cleanup".into());
    progress.message = Some("deleting previous collections".into());
    io.progress(&progress).await?;
    for old in previous {
        if backend.delete_collection(&old).await? {
            io.log(
                LogLevel::Info,
                &format!("deleted previous collection {old}"),
            )
            .await;
        }
    }
    delete_stale(io, backend, None).await?;

    progress.message = Some(format!("{processed} documents indexed"));
    io.progress(&progress).await?;
    Ok(JobOutcome::Completed)
}

/// Deletes `{alias}__*` collections that no alias points to. With `only_suffix`,
/// restricts deletion to that run's collections.
async fn delete_stale(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    only_suffix: Option<&str>,
) -> Result<()> {
    let mut targets = HashSet::new();
    for spec in COLLECTIONS.iter() {
        if let Some(target) = backend.get_alias(spec.name).await? {
            targets.insert(target);
        }
    }
    let collections = backend.list_collections().await?;
    for spec in COLLECTIONS.iter() {
        for name in collections.iter().filter(|c| is_physical_of(spec.name, c)) {
            if targets.contains(name) {
                continue;
            }
            if let Some(suffix) = only_suffix
                && *name != physical_name(spec.name, suffix)
            {
                continue;
            }
            if backend.delete_collection(name).await? {
                io.log(LogLevel::Info, &format!("deleted unused collection {name}"))
                    .await;
            }
        }
    }
    Ok(())
}

/// Stops at a batch boundary. A cancel also deletes this run's half-built
/// collections and clears the checkpoint (a retry starts over); a shutdown
/// keeps both so the next worker resumes.
async fn interrupted(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    cp: &FullCheckpoint,
    progress: &Progress,
) -> Result<JobOutcome> {
    if io.is_cancel_requested() {
        let mut progress = progress.clone();
        progress.phase = Some("cleanup".into());
        progress.message = Some("cancelled; deleting half-built collections".into());
        delete_stale(io, backend, Some(&cp.suffix)).await?;
        io.checkpoint(&progress, Value::Null).await?;
    }
    Ok(JobOutcome::Interrupted)
}

/// Rejects a payload that is not a JSON object (`{}` expected; unknown keys,
/// e.g. a legacy `drop`, are ignored).
pub fn validate_payload(payload: &Value) -> Result<()> {
    if !payload.is_object() {
        bail!("payload must be a JSON object");
    }
    Ok(())
}
