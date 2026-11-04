use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use serde_json::Value;

use crate::context::JobContext;

/// How a handler run ended (errors are returned as `Err`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JobOutcome {
    /// All work is done; the job becomes `succeeded` and its checkpoint is cleared.
    Completed,
    /// The handler stopped at a batch boundary because [`JobContext::should_stop`]
    /// returned true. The runner decides between `cancelled` (cancel requested)
    /// and re-queueing (shutdown); the last saved checkpoint is kept.
    Interrupted,
}

/// An error that retrying cannot fix (bad payload, missing configuration).
/// Returning it skips the remaining attempts and fails the job immediately.
#[derive(Debug, thiserror::Error)]
#[error("{0}")]
pub struct PermanentError(pub String);

impl PermanentError {
    pub fn err(message: impl Into<String>) -> anyhow::Error {
        anyhow::Error::new(Self(message.into()))
    }
}

pub fn is_permanent(error: &anyhow::Error) -> bool {
    error.chain().any(|cause| cause.is::<PermanentError>())
}

/// One job type. Adding a type = implement this trait in a module under
/// `src/jobs/` and add one `registry.register(...)` line in `jobs::registry`.
#[async_trait]
pub trait JobHandler: Send + Sync + 'static {
    /// The `jobs.type` value this handler executes, e.g. `search.reindex`.
    fn job_type(&self) -> &'static str;

    /// Concurrency key for jobs enqueued by the scheduler (at most one
    /// queued/running job per key). Must match the API's allowlist entry.
    fn concurrency_key(&self, _payload: &Value) -> Option<String> {
        None
    }

    /// Runs (or resumes, when `ctx.checkpoint()` is set) the job. Call
    /// `ctx.save_checkpoint(...)` after every batch and return
    /// [`JobOutcome::Interrupted`] when `ctx.should_stop()` is true.
    async fn run(&self, ctx: &JobContext) -> anyhow::Result<JobOutcome>;
}

#[derive(Default, Clone)]
pub struct Registry {
    handlers: HashMap<&'static str, Arc<dyn JobHandler>>,
}

impl Registry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register<H: JobHandler>(&mut self, handler: H) -> &mut Self {
        let job_type = handler.job_type();
        let previous = self.handlers.insert(job_type, Arc::new(handler));
        assert!(previous.is_none(), "job type {job_type} registered twice");
        self
    }

    pub fn get(&self, job_type: &str) -> Option<Arc<dyn JobHandler>> {
        self.handlers.get(job_type).cloned()
    }

    /// Sorted list of handled types (used to filter claims).
    pub fn job_types(&self) -> Vec<String> {
        let mut types: Vec<String> = self.handlers.keys().map(|t| t.to_string()).collect();
        types.sort();
        types
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Noop;

    #[async_trait]
    impl JobHandler for Noop {
        fn job_type(&self) -> &'static str {
            "test.noop"
        }
        async fn run(&self, _ctx: &JobContext) -> anyhow::Result<JobOutcome> {
            Ok(JobOutcome::Completed)
        }
    }

    #[test]
    fn registry_lookup() {
        let mut registry = Registry::new();
        registry.register(Noop);
        assert!(registry.get("test.noop").is_some());
        assert!(registry.get("other").is_none());
        assert_eq!(registry.job_types(), vec!["test.noop".to_string()]);
    }

    #[test]
    #[should_panic(expected = "registered twice")]
    fn duplicate_registration_panics() {
        let mut registry = Registry::new();
        registry.register(Noop);
        registry.register(Noop);
    }

    #[test]
    fn permanent_errors_are_detected_through_context() {
        let err = PermanentError::err("bad payload").context("search.reindex");
        assert!(is_permanent(&err));
        assert!(!is_permanent(&anyhow::anyhow!("network down")));
    }
}
