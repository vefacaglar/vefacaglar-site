use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use async_trait::async_trait;
use serde_json::{Value, json};

use super::*;
use crate::handler::is_permanent;

#[derive(Default)]
struct FakeIo {
    stop: AtomicBool,
    logs: Mutex<Vec<String>>,
    progress: Mutex<Vec<Progress>>,
}

#[async_trait]
impl JobIo for FakeIo {
    fn should_stop(&self) -> bool {
        self.stop.load(Ordering::SeqCst)
    }
    fn is_cancel_requested(&self) -> bool {
        self.should_stop()
    }
    async fn log(&self, _level: LogLevel, message: &str) {
        self.logs.lock().unwrap().push(message.into());
    }
    async fn progress(&self, progress: &Progress) -> Result<()> {
        self.progress.lock().unwrap().push(progress.clone());
        Ok(())
    }
    async fn checkpoint(&self, _progress: &Progress, _checkpoint: Value) -> Result<()> {
        panic!("full popularity refresh does not checkpoint")
    }
}

#[test]
fn payload_and_shared_indexing_lock_are_fixed() {
    assert!(validate_payload(&json!({})).is_ok());
    for payload in [json!(null), json!([]), json!({"command":"other"})] {
        assert!(is_permanent(&validate_payload(&payload).unwrap_err()));
    }
    assert_eq!(CatalogPopularityHandler.job_type(), JOB_TYPE);
    assert_eq!(
        CatalogPopularityHandler.concurrency_key(&json!({})),
        Some("search.index".into())
    );
}

#[test]
fn only_controlled_output_is_forwarded_and_secrets_are_redacted() {
    assert_eq!(safe_line("unexpected raw provider output", &[]), None);
    let safe = safe_line(
        "[catalog:popularity] failed: exact-private-value password=another-private",
        &["exact-private-value".into()],
    )
    .unwrap();
    assert!(!safe.contains("exact-private-value"));
    assert!(!safe.contains("another-private"));
    assert!(safe.contains("redacted"));
}

#[tokio::test]
async fn oversized_output_is_discarded_without_leaking_partial_values() {
    let raw = format!(
        "{PREFIX}{}\n{PREFIX}done\n",
        "private".repeat(MAX_LINE_BYTES)
    );
    let mut reader = BufReader::new(raw.as_bytes());
    assert!(
        bounded_line(&mut reader)
            .await
            .unwrap()
            .unwrap()
            .contains("details omitted")
    );
    assert_eq!(
        bounded_line(&mut reader).await.unwrap(),
        Some(format!("{PREFIX}done"))
    );
    assert_eq!(bounded_line(&mut reader).await.unwrap(), None);
}

#[cfg(unix)]
fn shell(script: &str) -> Command {
    // Static test fixtures only. Production never invokes a shell.
    let mut command = Command::new("sh");
    command.arg("-c").arg(script);
    command
}

#[cfg(unix)]
#[tokio::test]
async fn subprocess_success_drains_stdout_and_stderr_before_completion() {
    let io = FakeIo::default();
    let result = run_command(&io, shell("printf '[catalog:popularity] done\\n'; printf '[catalog:popularity] warning: secret=hidden\\n' >&2"), &[]).await.unwrap();
    assert_eq!(result, JobOutcome::Completed);
    let logs = io.logs.lock().unwrap();
    assert_eq!(logs.len(), 2);
    assert!(logs.iter().any(|line| line.contains("done")));
    assert!(logs.iter().all(|line| !line.contains("hidden")));
}

#[cfg(unix)]
#[tokio::test]
async fn subprocess_failure_is_retryable_and_missing_runtime_is_permanent() {
    let io = FakeIo::default();
    let error = run_command(&io, shell("exit 7"), &[]).await.unwrap_err();
    assert!(!is_permanent(&error));
    let error = run_command(&io, Command::new("/missing/catalog/node-runtime"), &[])
        .await
        .unwrap_err();
    assert!(is_permanent(&error));
}

#[cfg(unix)]
#[tokio::test]
async fn cancellation_kills_and_reaps_the_child_without_waiting_for_its_work() {
    let io = std::sync::Arc::new(FakeIo::default());
    let cancel = io.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(50)).await;
        cancel.stop.store(true, Ordering::SeqCst);
    });
    let result = tokio::time::timeout(
        Duration::from_secs(3),
        run_command(
            io.as_ref(),
            shell("printf '[catalog:popularity] pid: %s\\n' \"$$\"; exec sleep 60"),
            &[],
        ),
    )
    .await
    .unwrap()
    .unwrap();
    assert_eq!(result, JobOutcome::Interrupted);
    let pid = io
        .logs
        .lock()
        .unwrap()
        .iter()
        .find_map(|line| line.split("pid: ").nth(1).map(str::to_owned))
        .expect("child pid was logged");
    let alive = std::process::Command::new("kill")
        .args(["-0", &pid])
        .stderr(Stdio::null())
        .status()
        .unwrap()
        .success();
    assert!(
        !alive,
        "child must be killed and reaped before interruption returns"
    );
}

#[tokio::test]
async fn a_stopped_job_does_not_spawn_a_child() {
    let io = FakeIo::default();
    io.stop.store(true, Ordering::SeqCst);
    assert_eq!(
        run_command(&io, Command::new("/missing/runtime"), &[])
            .await
            .unwrap(),
        JobOutcome::Interrupted
    );
}

#[cfg(unix)]
#[tokio::test]
async fn only_a_successful_movie_process_can_request_one_continuation() {
    let io = FakeIo::default();
    let summary = r#"printf '[catalog:movies] result {"hasMore":true,"progressMade":true,"nextRunAt":null}\n'"#;
    let result = run_command_with_spec(&io, shell(summary), &[], &MOVIES)
        .await
        .unwrap();
    assert!(matches!(
        result,
        JobOutcome::CompletedWithContinuation { .. }
    ));
    let result = run_command_with_spec(&io, shell(summary), &[], &POPULARITY)
        .await
        .unwrap();
    assert_eq!(result, JobOutcome::Completed);
    let failed = format!("{summary}; exit 7");
    assert!(
        run_command_with_spec(&io, shell(&failed), &[], &MOVIES)
            .await
            .is_err()
    );
    let duplicate = format!("{summary}; {summary}");
    assert!(
        run_command_with_spec(&io, shell(&duplicate), &[], &MOVIES)
            .await
            .is_err()
    );
}

#[cfg(unix)]
#[tokio::test]
async fn movie_interest_output_cannot_create_a_catalog_continuation() {
    let io = FakeIo::default();
    let fixture = r#"printf '[catalog:movie-interest] result {"hasMore":true,"progressMade":true,"nextRunAt":null}\n'"#;
    let result = run_command_with_spec(&io, shell(fixture), &[], &MOVIE_POPULARITY)
        .await
        .unwrap();
    assert_eq!(result, JobOutcome::Completed);
}
