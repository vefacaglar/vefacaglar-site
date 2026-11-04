use std::io::IsTerminal;

use tracing_subscriber::EnvFilter;

/// Initializes tracing. Output is JSON unless stdout is a terminal, or as forced
/// by `WORKER_LOG_FORMAT=json|pretty`. Filtering follows `RUST_LOG` (default `info`).
pub fn init() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn,reqwest=warn,hyper=warn"));
    let json = match std::env::var("WORKER_LOG_FORMAT").ok().as_deref() {
        Some("json") => true,
        Some("pretty") => false,
        _ => !std::io::stdout().is_terminal(),
    };
    let builder = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(true);
    if json {
        builder
            .json()
            .flatten_event(true)
            .with_current_span(false)
            .init();
    } else {
        builder.init();
    }
}
