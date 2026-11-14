//! `search.reindex`: full rebuild with a zero-downtime index swap.
//!
//! 1. Fresh run: delete stale `{uid}__build_*` indexes, pick one run suffix
//!    and create a `{uid}__build_{suffix}` index (with its versioned settings)
//!    for every stable uid.
//! 2. Index every source into its build index (keyset batches, each write
//!    waited for, checkpoint `{suffix, collectionIndex, lastId}` after every
//!    batch, so a resumed run continues into the SAME build indexes).
//! 3. Only after ALL indexes are loaded, swap every build index with its
//!    stable uid in one atomic Meilisearch task (a missing stable uid is
//!    created by renaming its build index).
//! 4. Catch up: API writes made during the rebuild went to the old indexes and
//!    were swapped out, so re-upsert every row changed since the run started
//!    (minus [`CATCH_UP_MARGIN`]) into the stable indexes. Rows deleted during
//!    the rebuild become orphans that the next `search.sync` deletes.
//! 5. Delete the build indexes, which now hold the previous contents.
//!
//! A run resumed after the swap (crash between swap and cleanup) detects the
//! finished swap from Meilisearch's task history and only catches up and
//! cleans up.
//! Cancel deletes the half-built indexes; failures keep them for retry.

use std::collections::HashSet;

use anyhow::{Result, bail};
use chrono::{DateTime, Duration, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use super::backend::{SearchBackend, settings_match};
use super::indexes::{INDEXES, build_name, is_build_of, run_suffix};
use super::source::SourceData;
use super::{BATCH_SIZE, LOG_EVERY_BATCHES, import_batch};
use crate::context::{JobIo, Progress};
use crate::handler::JobOutcome;
use crate::queue::LogLevel;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullCheckpoint {
    /// Suffix of this run's build indexes (`yyyymmddhhmmss`).
    pub suffix: String,
    /// Index into [`INDEXES`] being loaded; `INDEXES.len()` = all loaded.
    pub collection_index: usize,
    /// Last indexed primary key within the current index.
    pub last_id: Option<Uuid>,
    /// When the run started; rows changed since then are re-upserted after
    /// the swap. Absent in checkpoints written before it existed (the suffix
    /// encodes the same time, to the second).
    #[serde(default)]
    pub started_at: Option<DateTime<Utc>>,
}

impl FullCheckpoint {
    fn started_at(&self) -> Option<DateTime<Utc>> {
        self.started_at.or_else(|| {
            NaiveDateTime::parse_from_str(&self.suffix, "%Y%m%d%H%M%S")
                .ok()
                .map(|at| at.and_utc())
        })
    }
}

/// Clock skew and in-flight transactions: rows stamped slightly before the
/// run start may still have been committed after their source page was read.
pub const CATCH_UP_MARGIN: Duration = Duration::minutes(5);

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
        message: Some("preparing indexes".into()),
        ..Default::default()
    };
    io.progress(&progress).await?;

    let checkpoint =
        checkpoint.filter(|c| is_valid_suffix(&c.suffix) && c.collection_index <= INDEXES.len());
    let fresh = checkpoint.is_none();
    let mut cp = checkpoint.unwrap_or_else(|| FullCheckpoint {
        suffix: run_suffix(now),
        collection_index: 0,
        last_id: None,
        started_at: Some(now),
    });

    // All indexes were loaded before the interruption: the swap may already
    // have happened (one atomic task covers every index).
    if !fresh
        && cp.collection_index == INDEXES.len()
        && backend
            .was_swapped(&build_name(INDEXES[0].name, &cp.suffix))
            .await?
    {
        io.log(
            LogLevel::Info,
            &format!(
                "full reindex (run suffix {}) was already swapped in; cleaning up",
                cp.suffix
            ),
        )
        .await;
        catch_up(io, backend, source, &cp, &mut progress).await?;
        progress.message = Some("index swap finished".into());
        return finish(io, backend, &mut progress).await;
    }

    if fresh {
        progress.phase = Some("cleanup".into());
        progress.message = Some("removing stale build indexes".into());
        io.progress(&progress).await?;
        delete_builds(io, backend, None).await?;
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
                INDEXES
                    .get(cp.collection_index)
                    .map_or("index swap", |c| c.name),
                cp.last_id
                    .map_or_else(|| "start".to_string(), |id| id.to_string())
            ),
        )
        .await;
    }

    // Every build index of this run must exist with the current settings; a
    // loaded one that vanished (or whose settings changed) is rebuilt.
    let existing: HashSet<String> = backend.list_indexes().await?.into_iter().collect();
    for (index, spec) in INDEXES.iter().enumerate() {
        let build = build_name(spec.name, &cp.suffix);
        let settings = spec.settings();
        if existing.contains(&build) {
            let current = backend
                .settings(&build)
                .await?
                .is_some_and(|actual| settings_match(&actual, &settings));
            if current {
                continue;
            }
            backend.delete_index(&build).await?;
        }
        backend.create_index(&build, &settings).await?;
        let lost_data =
            index < cp.collection_index || (index == cp.collection_index && cp.last_id.is_some());
        if !fresh && lost_data {
            io.log(
                LogLevel::Warn,
                &format!(
                    "build index {build} was missing or outdated; re-indexing from {}",
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
    let mut counts = Vec::with_capacity(INDEXES.len());
    for spec in INDEXES.iter() {
        counts.push(source.count(spec.source, None).await?);
    }
    let total: u64 = counts.iter().sum();
    let mut processed: u64 = counts[..cp.collection_index.min(INDEXES.len())]
        .iter()
        .sum();
    if let (Some(last_id), Some(spec)) = (cp.last_id, INDEXES.get(cp.collection_index)) {
        processed += source.count(spec.source, Some(last_id)).await?;
    }
    progress.total = Some(total.max(processed));
    progress.processed = Some(processed);
    io.checkpoint(&progress, serde_json::to_value(&cp)?).await?;
    io.log(
        LogLevel::Info,
        &format!(
            "{total} documents to index: {}",
            INDEXES
                .iter()
                .zip(&counts)
                .map(|(c, n)| format!("{} {n}", c.name))
                .collect::<Vec<_>>()
                .join(", ")
        ),
    )
    .await;

    // Index.
    while cp.collection_index < INDEXES.len() {
        if io.should_stop() {
            return interrupted(io, backend, &cp, &progress).await;
        }
        let spec = &INDEXES[cp.collection_index];
        let build = build_name(spec.name, &cp.suffix);
        let count = counts[cp.collection_index];
        let mut in_index = match cp.last_id {
            Some(last_id) => source.count(spec.source, Some(last_id)).await?,
            None => 0,
        };
        if cp.last_id.is_none() {
            io.log(
                LogLevel::Info,
                &format!("{}: indexing {count} documents into {build}", spec.name),
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
            import_batch(io, backend, &build, spec.name, &page.docs).await?;
            let n = page.docs.len() as u64;
            processed += n;
            in_index += n;
            batches += 1;
            cp.last_id = page.last_id;
            progress.phase = Some(phase.clone());
            progress.processed = Some(processed);
            progress.total = Some(total.max(processed));
            progress.message = Some(format!("{}: {in_index}/{count}", spec.name));
            io.checkpoint(&progress, serde_json::to_value(&cp)?).await?;
            if batches.is_multiple_of(LOG_EVERY_BATCHES) {
                io.log(
                    LogLevel::Info,
                    &format!("{}: {in_index}/{count} indexed", spec.name),
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
            &format!("{}: {in_index} documents indexed", spec.name),
        )
        .await;
        cp.collection_index += 1;
        cp.last_id = None;
        io.checkpoint(&progress, serde_json::to_value(&cp)?).await?;
    }

    // Swap every index only now that every build is fully loaded, in one
    // atomic task. No stop checks from here on: the remaining steps are quick
    // and a resumed run detects a finished swap.
    progress.phase = Some("swapping indexes".into());
    progress.message = Some("swapping the new indexes in".into());
    io.progress(&progress).await?;
    let builds: Vec<String> = INDEXES
        .iter()
        .map(|spec| build_name(spec.name, &cp.suffix))
        .collect();
    let pairs: Vec<(&str, &str)> = INDEXES
        .iter()
        .zip(&builds)
        .map(|(spec, build)| (spec.name, build.as_str()))
        .collect();
    backend.swap_indexes(&pairs).await?;
    io.log(
        LogLevel::Info,
        &format!(
            "swapped in {}",
            pairs
                .iter()
                .map(|(stable, build)| format!("{stable} <- {build}"))
                .collect::<Vec<_>>()
                .join(", ")
        ),
    )
    .await;

    catch_up(io, backend, source, &cp, &mut progress).await?;
    progress.message = Some(format!("{processed} documents indexed"));
    finish(io, backend, &mut progress).await
}

/// Re-upserts every row changed since the run started into the stable
/// indexes. Idempotent, so a resumed run simply repeats it.
async fn catch_up(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    source: &dyn SourceData,
    cp: &FullCheckpoint,
    progress: &mut Progress,
) -> Result<()> {
    let Some(started_at) = cp.started_at() else {
        io.log(
            LogLevel::Warn,
            &format!(
                "run suffix {} has no start time; skipping the post-swap catch-up",
                cp.suffix
            ),
        )
        .await;
        return Ok(());
    };
    let since = started_at - CATCH_UP_MARGIN;
    progress.phase = Some("catching up".into());
    progress.message = Some("re-indexing rows changed during the rebuild".into());
    io.progress(progress).await?;
    for spec in INDEXES.iter() {
        let mut after = None;
        let mut upserted = 0usize;
        loop {
            let page = source
                .changed_page(spec.source, since, after, BATCH_SIZE)
                .await?;
            import_batch(io, backend, spec.name, spec.name, &page.docs).await?;
            upserted += page.docs.len();
            after = page.last_id;
            if page.docs.len() < BATCH_SIZE {
                break;
            }
        }
        if upserted > 0 {
            io.log(
                LogLevel::Info,
                &format!(
                    "{}: {upserted} documents changed during the rebuild re-indexed",
                    spec.name
                ),
            )
            .await;
        }
    }
    Ok(())
}

/// Deletes the build indexes, which hold the previous contents after a swap.
/// `progress.message` is restored as the final message.
async fn finish(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    progress: &mut Progress,
) -> Result<JobOutcome> {
    let done = progress.message.take();
    progress.phase = Some("cleanup".into());
    progress.message = Some("deleting previous indexes".into());
    io.progress(progress).await?;
    delete_builds(io, backend, None).await?;
    progress.message = done;
    io.progress(progress).await?;
    Ok(JobOutcome::Completed)
}

/// Deletes `{uid}__build_*` indexes. The API only queries stable uids, so
/// no build index is ever live. With `only_suffix`, restricts deletion to
/// that run's build indexes.
pub(crate) async fn delete_builds(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    only_suffix: Option<&str>,
) -> Result<()> {
    let indexes = backend.list_indexes().await?;
    for spec in INDEXES.iter() {
        for name in indexes.iter().filter(|c| is_build_of(spec.name, c)) {
            if let Some(suffix) = only_suffix
                && *name != build_name(spec.name, suffix)
            {
                continue;
            }
            if backend.delete_index(name).await? {
                io.log(LogLevel::Info, &format!("deleted build index {name}"))
                    .await;
            }
        }
    }
    Ok(())
}

/// Stops at a batch boundary. A cancel also deletes this run's half-built
/// indexes and clears the checkpoint (a retry starts over); a shutdown keeps
/// both so the next worker resumes.
async fn interrupted(
    io: &dyn JobIo,
    backend: &dyn SearchBackend,
    cp: &FullCheckpoint,
    progress: &Progress,
) -> Result<JobOutcome> {
    if io.is_cancel_requested() {
        let mut progress = progress.clone();
        progress.phase = Some("cleanup".into());
        progress.message = Some("cancelled; deleting half-built indexes".into());
        delete_builds(io, backend, Some(&cp.suffix)).await?;
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
