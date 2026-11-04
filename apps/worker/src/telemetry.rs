use std::io::IsTerminal;

use tracing_subscriber::{EnvFilter, prelude::*};

mod application_logs;
mod error_details;
mod error_message;

pub use application_logs::LogDrain;
pub use error_details::{application_stack, database_error};
pub use error_message::error_messages;

/// Initializes tracing. Output is JSON unless stdout is a terminal, or as forced
/// by `WORKER_LOG_FORMAT=json|pretty`. Filtering follows `RUST_LOG` (default `info`).
pub fn init() -> Option<LogDrain> {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn,reqwest=warn,hyper=warn"));
    let json = match std::env::var("WORKER_LOG_FORMAT").ok().as_deref() {
        Some("json") => true,
        Some("pretty") => false,
        _ => !std::io::stdout().is_terminal(),
    };
    let (layer, drain) = match application_logs::start() {
        Some((layer, drain)) => (Some(layer), Some(drain)),
        None => (None, None),
    };
    let subscriber = tracing_subscriber::registry().with(filter).with(layer);
    let console = tracing_subscriber::fmt::layer().with_target(true);
    if json {
        subscriber
            .with(console.json().flatten_event(true).with_current_span(false))
            .init();
    } else {
        subscriber.with(console).init();
    }
    if drain.is_some() {
        let previous_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |panic| {
            let location = panic.location().and_then(|location| {
                let file = error_details::application_file(location.file())?;
                Some(format!("{file}:{}:{}", location.line(), location.column()))
            });
            let stack = application_stack(&std::backtrace::Backtrace::force_capture());
            tracing::error!(
                application_event = "worker_panicked",
                error_code = "worker_panic",
                error_source = location.as_deref(),
                origin_stack = stack.as_deref(),
                "Worker task panicked"
            );
            previous_hook(panic);
        }));
    }
    drain
}
