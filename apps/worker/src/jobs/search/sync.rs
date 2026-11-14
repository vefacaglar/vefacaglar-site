//! `search.sync`: heal drift in the live indexes.
//!
//! First deletes leftover `{uid}__build_*` indexes (a failed or abandoned
//! rebuild). Then, for every stable index uid (missing = fail; the job handler
//! escalates to a full rebuild before calling this), fetch the existing ids,
//! diff them against Postgres, delete orphans (documents without a source row,
//! e.g. a row deleted during a rebuild) and upsert the missing documents.
//!
//! Orphan deletion relies on the read order: the indexed ids are read BEFORE
//! the source ids. A document can only be an orphan if it was indexed before
//! the source read started, so a row that still exists is always seen by the
//! source read; rows created after the index read are never in `indexed`.

use std::collections::HashSet;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::backend::SearchBackend;
use super::full::delete_builds;
use super::indexes::INDEXES;
use super::source::SourceData;
use super::{BATCH_SIZE, LOG_EVERY_BATCHES, import_batch};
use crate::context::{JobIo, Progress};
use crate::handler::{JobOutcome, PermanentError};
use crate::queue::LogLevel;

/// Ids read per query while diffing.
const ID_PAGE: usize = 5_000;
/// Orphan ids per delete request.
const ORPHAN_BATCH: usize = 1_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncCheckpoint {
    /// Indexes before this position in `INDEXES` are done.
    pub collection_index: usize,
}

/// Result of comparing source ids with indexed ids.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Diff {
    /// Source ids without a document, in source (id) order.
    pub missing: Vec<Uuid>,
    /// Indexed document ids without a source row, sorted.
    pub orphans: Vec<String>,
}

/// Pure diff: `source_ids` must not contain duplicates.
pub fn diff(source_ids: impl IntoIterator<Item = Uuid>, indexed: &HashSet<String>) -> Diff {
    let mut missing = Vec::new();
    let mut present = HashSet::new();
    for id in source_ids {
        let id_string = id.to_string();
        if indexed.contains(&id_string) {
            present.insert(id_string);
        } else {
            missing.push(id);
        }
    }
    let mut orphans: Vec<String> = indexed.difference(&present).cloned().collect();
    orphans.sort();
    Diff { missing, orphans }
}

/// The live target of a stable uid: the index itself, which must exist.
async fn resolve(backend: &dyn SearchBackend, name: &str) -> Result<String> {
    if backend.index_exists(name).await? {
        return Ok(name.to_string());
    }
    Err(PermanentError::err(format!(
        "search index {name} does not exist; run the full reindex (search.reindex) first"
    )))
}

pub async fn run(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    source: &dyn SourceData,
    checkpoint: Option<SyncCheckpoint>,
) -> Result<JobOutcome> {
    if io.should_stop() {
        return Ok(JobOutcome::Interrupted);
    }
    let start = checkpoint
        .map(|c| c.collection_index.min(INDEXES.len()))
        .unwrap_or(0);
    let mut progress = Progress {
        phase: Some("resolving".into()),
        message: Some("resolving indexes".into()),
        ..Default::default()
    };
    io.progress(&progress).await?;
    if start == 0 {
        delete_builds(io, backend, None).await?;
    }

    // Resolve everything first, so a missing index fails before any work.
    let mut targets = Vec::new();
    for spec in &INDEXES[start..] {
        targets.push(resolve(backend, spec.name).await?);
    }
    if start > 0 {
        io.log(
            LogLevel::Info,
            &format!(
                "resuming sync at {}",
                INDEXES.get(start).map_or("end", |c| c.name)
            ),
        )
        .await;
    }

    // Diff all remaining indexes up front for a determinate total.
    let mut diffs = Vec::new();
    for (spec, target) in INDEXES[start..].iter().zip(&targets) {
        if io.should_stop() {
            return Ok(JobOutcome::Interrupted);
        }
        progress.phase = Some(format!("diffing:{}", spec.name));
        progress.message = Some(format!("{}: comparing ids", spec.name));
        io.progress(&progress).await?;
        // Indexed ids first, then source ids: see the module docs.
        let indexed = backend.document_ids(target).await?;
        let mut source_ids = Vec::new();
        let mut after = None;
        loop {
            let page = source.ids_page(spec.source, after, ID_PAGE).await?;
            after = page.last().copied();
            let len = page.len();
            source_ids.extend(page);
            if len < ID_PAGE {
                break;
            }
        }
        let d = diff(source_ids, &indexed);
        io.log(
            LogLevel::Info,
            &format!(
                "{}: {} missing, {} orphaned (indexed {}, target {target})",
                spec.name,
                d.missing.len(),
                d.orphans.len(),
                indexed.len()
            ),
        )
        .await;
        diffs.push(d);
    }

    let total: u64 = diffs.iter().map(|d| d.missing.len() as u64).sum();
    let mut processed: u64 = 0;
    progress.total = Some(total);
    progress.processed = Some(0);
    progress.message = Some(format!("{total} missing documents"));
    io.progress(&progress).await?;

    for (offset, (diff, target)) in diffs.iter().zip(&targets).enumerate() {
        let index = start + offset;
        let spec = &INDEXES[index];
        if io.should_stop() {
            return Ok(JobOutcome::Interrupted);
        }
        for ids in diff.orphans.chunks(ORPHAN_BATCH) {
            backend.delete_documents(target, ids).await?;
        }
        let mut indexed = 0u64;
        progress.phase = Some(format!("indexing:{}", spec.name));
        for (batch, ids) in diff.missing.chunks(BATCH_SIZE).enumerate() {
            let docs = source.docs_by_ids(spec.source, ids).await?;
            import_batch(io, backend, target, spec.name, &docs).await?;
            indexed += docs.len() as u64;
            // Rows deleted since the diff still count as handled.
            processed += ids.len() as u64;
            progress.processed = Some(processed);
            progress.message = Some(format!("{}: {indexed}/{}", spec.name, diff.missing.len()));
            let cp = SyncCheckpoint {
                collection_index: index,
            };
            io.checkpoint(&progress, serde_json::to_value(cp)?).await?;
            if (batch as u64 + 1).is_multiple_of(LOG_EVERY_BATCHES) {
                io.log(
                    LogLevel::Info,
                    &format!("{}: {indexed}/{} indexed", spec.name, diff.missing.len()),
                )
                .await;
            }
            if io.should_stop() {
                return Ok(JobOutcome::Interrupted);
            }
        }
        io.log(
            LogLevel::Info,
            &format!(
                "{}: {} missing, {indexed} indexed, {} orphans deleted",
                spec.name,
                diff.missing.len(),
                diff.orphans.len()
            ),
        )
        .await;
        let cp = SyncCheckpoint {
            collection_index: index + 1,
        };
        io.checkpoint(&progress, serde_json::to_value(cp)?).await?;
    }
    progress.phase = Some("done".into());
    progress.message = Some(format!("{processed} missing documents indexed"));
    io.progress(&progress).await?;
    Ok(JobOutcome::Completed)
}
