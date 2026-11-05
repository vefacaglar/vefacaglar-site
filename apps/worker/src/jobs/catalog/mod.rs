//! Runs the existing TypeScript popularity pipeline inside the worker image.
//! Scores are not reimplemented in Rust; retries replay the idempotent refresh.

use std::path::Path;
use std::process::Stdio;
use std::time::Duration;

use anyhow::{Context as _, Result};
use async_trait::async_trait;
use serde_json::Value;
use tokio::io::{AsyncBufRead, AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;

use crate::context::{JobContext, JobIo, Progress};
use crate::handler::{JobHandler, JobOutcome, PermanentError};
use crate::queue::LogLevel;

pub const JOB_TYPE: &str = "catalog.popularity.refresh";
// Serializes live game writes with full reindex alias swaps across all workers.
pub const CONCURRENCY_KEY: &str = "search.index";
const SCRIPT: &str = "/app/apps/api/dist/scripts/refresh-popularity.js";
const PREFIX: &str = "[catalog:popularity] ";
const MAX_LINE_BYTES: usize = 4096;

pub struct CatalogPopularityHandler;

#[async_trait]
impl JobHandler for CatalogPopularityHandler {
    fn job_type(&self) -> &'static str {
        JOB_TYPE
    }

    fn concurrency_key(&self, _payload: &Value) -> Option<String> {
        Some(CONCURRENCY_KEY.into())
    }

    async fn run(&self, ctx: &JobContext) -> Result<JobOutcome> {
        validate_payload(ctx.payload())?;
        for key in [
            "DATABASE_URL",
            "IGDB_CLIENT_ID",
            "IGDB_CLIENT_SECRET",
            "TYPESENSE_API_KEY",
        ] {
            if std::env::var(key).unwrap_or_default().trim().is_empty() {
                return Err(PermanentError::err(format!(
                    "{key} is required for game popularity refresh"
                )));
            }
        }
        if ["TYPESENSE_HOST", "TYPESENSE_PUBLIC_URL"]
            .iter()
            .all(|key| std::env::var(key).unwrap_or_default().trim().is_empty())
        {
            return Err(PermanentError::err(
                "Configure TYPESENSE_HOST or TYPESENSE_PUBLIC_URL for game popularity refresh",
            ));
        }
        let binary =
            std::env::var("CATALOG_NODE_BINARY").unwrap_or_else(|_| "/usr/local/bin/node".into());
        let script = std::env::var("CATALOG_REFRESH_SCRIPT").unwrap_or_else(|_| SCRIPT.into());
        if !Path::new(&script).is_file() {
            return Err(PermanentError::err(
                "The compiled catalog refresh CLI is missing; deploy the current worker image",
            ));
        }
        let secrets = [
            "DATABASE_URL",
            "IGDB_CLIENT_ID",
            "IGDB_CLIENT_SECRET",
            "TYPESENSE_API_KEY",
            "LOG_TYPESENSE_API_KEY",
        ]
        .into_iter()
        .filter_map(|key| std::env::var(key).ok())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
        let mut command = Command::new(binary);
        command
            .arg("--enable-source-maps")
            .arg(script)
            .current_dir("/app");
        run_command(ctx, command, &secrets).await
    }
}

fn validate_payload(payload: &Value) -> Result<()> {
    if payload.as_object().is_none_or(|object| !object.is_empty()) {
        return Err(PermanentError::err(
            "catalog.popularity.refresh expects an empty payload",
        ));
    }
    Ok(())
}

/// No shell or user-supplied command. The runner's heartbeat remains independent
/// while this child works. All exits stop and reap it; kill_on_drop also covers
/// a task aborted at the worker's shutdown deadline.
async fn run_command(
    io: &dyn JobIo,
    mut command: Command,
    secrets: &[String],
) -> Result<JobOutcome> {
    if io.should_stop() {
        return Ok(JobOutcome::Interrupted);
    }
    io.progress(&Progress {
        phase: Some("refreshing game popularity".into()),
        ..Default::default()
    })
    .await?;
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|_| {
            PermanentError::err(
                "Could not start the catalog Node runtime; deploy the current worker image",
            )
        })?;
    let (sender, mut lines) = mpsc::channel(32);
    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");
    let readers = [
        tokio::spawn(read_output(
            BufReader::new(stdout),
            sender.clone(),
            LogLevel::Info,
        )),
        tokio::spawn(read_output(
            BufReader::new(stderr),
            sender.clone(),
            LogLevel::Warn,
        )),
    ];
    drop(sender);
    let mut poll = tokio::time::interval(Duration::from_secs(1));
    let mut status = None;
    let mut output_closed = false;
    let result = loop {
        if status.is_some() && output_closed {
            break if status
                .as_ref()
                .is_some_and(std::process::ExitStatus::success)
            {
                Ok(JobOutcome::Completed)
            } else {
                Err(anyhow::anyhow!(
                    "Catalog popularity refresh failed; see the job log for its sanitized summary"
                ))
            };
        }
        tokio::select! {
            exited = child.wait(), if status.is_none() => {
                match exited { Ok(exited) => status = Some(exited), Err(error) => break Err(error).context("wait for catalog refresh process") }
            }
            line = lines.recv(), if !output_closed => {
                match line {
                    Some((level, line)) => {
                        if let Some(message) = safe_line(&line, secrets) {
                            io.log(level, &format!("Catalog popularity: {message}")).await;
                            if let Err(error) = io.progress(&Progress { phase: Some("refreshing game popularity".into()), message: Some(message), ..Default::default() }).await {
                                break Err(error);
                            }
                        }
                    }
                    None => output_closed = true,
                }
            }
            _ = poll.tick() => {
                if io.should_stop() { break Ok(JobOutcome::Interrupted); }
            }
        }
    };
    if status.is_none() {
        // kill() waits for the process; wait() is repeated defensively to reap
        // even when the process exited between the poll and the kill request.
        let _ = child.kill().await;
        let _ = child.wait().await;
    }
    for reader in readers {
        reader.abort();
        let _ = reader.await;
    }
    if matches!(result, Ok(JobOutcome::Interrupted)) {
        io.log(
            LogLevel::Info,
            "Catalog refresh stopped; its next attempt will safely rerun the full refresh",
        )
        .await;
    }
    result
}

fn safe_line(line: &str, secrets: &[String]) -> Option<String> {
    let mut message = line.strip_prefix(PREFIX)?.to_owned();
    for secret in secrets {
        message = message.replace(secret, "[redacted]");
    }
    crate::telemetry::error_messages(anyhow::anyhow!(message).as_ref())
}

async fn read_output<R: AsyncBufRead + Unpin>(
    mut reader: R,
    sender: mpsc::Sender<(LogLevel, String)>,
    level: LogLevel,
) {
    loop {
        match bounded_line(&mut reader).await {
            Ok(Some(line)) => {
                if sender.send((level, line)).await.is_err() {
                    break;
                }
            }
            Ok(None) => break,
            Err(_) => {
                let _ = sender
                    .send((
                        LogLevel::Warn,
                        format!("{PREFIX}could not read subprocess output"),
                    ))
                    .await;
                break;
            }
        }
    }
}

/// Discard the rest of oversized lines without buffering them or leaking a
/// partially truncated credential into the dashboard.
async fn bounded_line<R: AsyncBufRead + Unpin>(reader: &mut R) -> std::io::Result<Option<String>> {
    let mut line = Vec::new();
    let mut oversized = false;
    loop {
        let buffer = reader.fill_buf().await?;
        if buffer.is_empty() {
            break;
        }
        let end = buffer.iter().position(|byte| *byte == b'\n');
        let consumed = end.map_or(buffer.len(), |index| index + 1);
        if !oversized {
            if line.len() + consumed > MAX_LINE_BYTES {
                oversized = true;
                line.clear();
            } else {
                line.extend_from_slice(&buffer[..consumed]);
            }
        }
        reader.consume(consumed);
        if end.is_some() {
            break;
        }
    }
    if oversized {
        return Ok(Some(format!(
            "{PREFIX}subprocess log line exceeded its limit; details omitted"
        )));
    }
    if line.is_empty() {
        return Ok(None);
    }
    Ok(Some(String::from_utf8_lossy(&line).trim_end().to_owned()))
}

#[cfg(test)]
mod tests;
