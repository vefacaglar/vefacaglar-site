//! Enriches JSON stdout lines of tagged application events (those with an
//! `application_event` field) with safe, derived error details: a stable
//! `error_code`, a fixed `response_message`, a redacted `diagnostic` chain
//! and, for warnings and errors, the `error_source` and an application-only
//! `stack`. The container log shipper collects stdout, so this is where these
//! details are delivered; nothing is sent anywhere else.

use std::backtrace::Backtrace;
use std::fmt::{self, Write as _};

use serde_json::{Map, Value};
use tracing::field::{Field, Visit};
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::fmt::{FmtContext, FormatEvent, FormatFields};
use tracing_subscriber::registry::LookupSpan;

use super::error_details::{application_stack, describe_error};
use super::error_message::error_messages;

#[derive(Default)]
struct LogFields {
    tagged: bool,
    error_code: Option<String>,
    response_message: Option<String>,
    diagnostic: Option<String>,
    error_source: Option<String>,
    origin_stack: Option<String>,
}

impl Visit for LogFields {
    fn record_str(&mut self, field: &Field, value: &str) {
        match field.name() {
            "application_event" => self.tagged = true,
            "error_source" => self.error_source = Some(value.to_owned()),
            "origin_stack" => self.origin_stack = Some(value.to_owned()),
            _ => {}
        }
    }

    fn record_debug(&mut self, field: &Field, _value: &dyn fmt::Debug) {
        if field.name() == "application_event" {
            self.tagged = true;
        }
    }

    fn record_error(&mut self, field: &Field, value: &(dyn std::error::Error + 'static)) {
        if field.name() == "error" {
            let (code, reason) = describe_error(value);
            self.error_code = Some(code);
            self.response_message = Some(reason.to_owned());
            self.diagnostic = error_messages(value);
        }
    }
}

/// Wraps the JSON event formatter; untagged events pass through unchanged.
pub(super) struct Enriched<F>(pub F);

impl<S, N, F> FormatEvent<S, N> for Enriched<F>
where
    S: Subscriber + for<'a> LookupSpan<'a>,
    N: for<'a> FormatFields<'a> + 'static,
    F: FormatEvent<S, N>,
{
    fn format_event(
        &self,
        ctx: &FmtContext<'_, S, N>,
        mut writer: Writer<'_>,
        event: &Event<'_>,
    ) -> fmt::Result {
        let mut line = String::new();
        self.0.format_event(ctx, Writer::new(&mut line), event)?;
        match enrich(&line, event) {
            Some(enriched) => writeln!(writer, "{enriched}"),
            None => writer.write_str(&line),
        }
    }
}

fn enrich(line: &str, event: &Event<'_>) -> Option<String> {
    let metadata = event.metadata();
    metadata.fields().field("application_event")?;
    let mut fields = LogFields::default();
    event.record(&mut fields);
    if !fields.tagged {
        return None;
    }
    let Ok(Value::Object(mut object)) = serde_json::from_str::<Value>(line.trim_end()) else {
        return None;
    };
    let insert = |object: &mut Map<String, Value>, key: &str, value: Option<String>| {
        if let Some(value) = value
            && !object.contains_key(key)
        {
            object.insert(key.to_owned(), Value::String(value));
        }
    };
    insert(&mut object, "error_code", fields.error_code);
    insert(&mut object, "response_message", fields.response_message);
    insert(&mut object, "diagnostic", fields.diagnostic);
    if matches!(*metadata.level(), Level::ERROR | Level::WARN) {
        let reported_at = metadata
            .file()
            .zip(metadata.line())
            .map(|(file, line)| format!("{file}:{line}"));
        let origin = fields
            .origin_stack
            .as_deref()
            .and_then(|stack| stack.lines().next())
            .map(str::to_owned);
        let stack = match fields.origin_stack {
            Some(stack) => Some(stack),
            None => reported_at.as_deref().map(|reported_at| {
                let reporting = match application_stack(&Backtrace::force_capture()) {
                    Some(trace) => format!("Reported at {reported_at}\n{trace}"),
                    None => format!("Reported at {reported_at}"),
                };
                match fields.error_source.as_deref() {
                    Some(location) => format!("Failure at {location}\n{reporting}"),
                    None => reporting,
                }
            }),
        };
        insert(
            &mut object,
            "error_source",
            fields.error_source.or(origin).or(reported_at),
        );
        insert(&mut object, "stack", stack);
    }
    let mut out = String::new();
    write!(out, "{}", Value::Object(object)).ok()?;
    Some(out)
}

#[cfg(test)]
mod tests {
    use std::io;
    use std::sync::{Arc, Mutex};

    use tracing_subscriber::fmt::MakeWriter;
    use tracing_subscriber::prelude::*;

    use super::*;

    #[derive(Clone, Default)]
    struct Buffer(Arc<Mutex<Vec<u8>>>);

    impl io::Write for Buffer {
        fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(buf);
            Ok(buf.len())
        }
        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    impl<'a> MakeWriter<'a> for Buffer {
        type Writer = Buffer;
        fn make_writer(&'a self) -> Self::Writer {
            self.clone()
        }
    }

    fn capture(emit: impl FnOnce()) -> Vec<Value> {
        let buffer = Buffer::default();
        let format = tracing_subscriber::fmt::format()
            .json()
            .flatten_event(true)
            .with_current_span(false);
        let layer = tracing_subscriber::fmt::layer()
            .json()
            .flatten_event(true)
            .with_current_span(false)
            .event_format(Enriched(format))
            .with_writer(buffer.clone());
        let subscriber = tracing_subscriber::registry().with(layer);
        tracing::subscriber::with_default(subscriber, emit);
        let text = String::from_utf8(buffer.0.lock().unwrap().clone()).unwrap();
        text.lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }

    #[test]
    fn tagged_warning_gets_safe_error_details_on_stdout() {
        let lines = capture(|| {
            let error = io::Error::new(io::ErrorKind::PermissionDenied, "private path");
            tracing::warn!(
                application_event = "health_file_write_failed",
                error = &error as &dyn std::error::Error,
                "cannot write health file"
            );
        });
        let line = &lines[0];
        assert_eq!(line["application_event"], "health_file_write_failed");
        assert_eq!(line["message"], "cannot write health file");
        assert_eq!(line["error_code"], "io_permission_denied");
        assert_eq!(
            line["response_message"],
            "the worker lacks filesystem permissions"
        );
        assert!(
            line["error_source"]
                .as_str()
                .unwrap()
                .contains("structured.rs")
        );
        assert!(line["stack"].as_str().unwrap().starts_with("Reported at "));
    }

    #[test]
    fn explicit_fields_win_and_untagged_events_are_unchanged() {
        let lines = capture(|| {
            tracing::error!(
                application_event = "worker_failed",
                error_code = "missing_database_url",
                response_message = "DATABASE_URL is required.",
                "worker failed"
            );
            tracing::info!(count = 3, "plain event");
        });
        assert_eq!(lines[0]["error_code"], "missing_database_url");
        assert_eq!(lines[0]["response_message"], "DATABASE_URL is required.");
        assert!(lines[1].get("error_code").is_none());
        assert!(lines[1].get("stack").is_none());
        assert_eq!(lines[1]["count"], 3);
    }
}
