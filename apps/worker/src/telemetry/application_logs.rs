use std::fmt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use reqwest::{Client, StatusCode, Url};
use serde::Serialize;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;
use tracing::field::{Field, Visit};
use tracing::{Event, Level, Subscriber};
use tracing_subscriber::layer::{Context, Layer};

const COLLECTION: &str = "application_logs_v1";
const SCHEMA: &str = include_str!("../application_logs_v1.json");
const SERVICE: &str = "vefacaglar-site-worker";
const QUEUE_CAPACITY: usize = 256;

#[derive(Serialize)]
struct LogDocument {
    timestamp: i64,
    service: &'static str,
    environment: String,
    level: &'static str,
    event: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_message: Option<String>,
}

#[derive(Default)]
struct LogFields {
    event: Option<String>,
    message: Option<String>,
    error_code: Option<String>,
    response_message: Option<String>,
}

impl Visit for LogFields {
    fn record_str(&mut self, field: &Field, value: &str) {
        match field.name() {
            "application_event" => self.event = Some(value.to_owned()),
            "message" => self.message = Some(value.to_owned()),
            "error_code" => self.error_code = Some(value.to_owned()),
            "response_message" => self.response_message = Some(value.to_owned()),
            _ => {}
        }
    }

    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        if field.name() == "message" {
            self.message = Some(format!("{value:?}"));
        }
    }
}

pub(super) struct LogLayer {
    sender: mpsc::Sender<LogDocument>,
    environment: String,
    overflow_reported: AtomicBool,
}

impl<S: Subscriber> Layer<S> for LogLayer {
    fn on_event(&self, event: &Event<'_>, _: Context<'_, S>) {
        let metadata = event.metadata();
        if metadata.fields().field("application_event").is_none() {
            return;
        }
        let level = match *metadata.level() {
            Level::ERROR => "error",
            Level::WARN => "warning",
            Level::INFO => "info",
            _ => return,
        };
        // Tagged events use fixed messages and may supply a safe error reason.
        // Raw error and other tracing fields stay local.
        let mut fields = LogFields::default();
        event.record(&mut fields);
        let (Some(event), Some(message)) = (fields.event, fields.message) else {
            return;
        };
        let document = LogDocument {
            timestamp: chrono::Utc::now().timestamp_millis(),
            service: SERVICE,
            environment: self.environment.clone(),
            level,
            event,
            message,
            error_code: fields.error_code,
            response_message: fields.response_message,
        };
        if let Err(mpsc::error::TrySendError::Full(_)) = self.sender.try_send(document)
            && !self.overflow_reported.swap(true, Ordering::Relaxed)
        {
            eprintln!("Typesense log queue full; dropping remote events");
        }
    }
}

pub struct LogDrain {
    stop: CancellationToken,
    task: JoinHandle<()>,
}

impl LogDrain {
    pub async fn close(mut self) {
        self.stop.cancel();
        if tokio::time::timeout(Duration::from_secs(3), &mut self.task)
            .await
            .is_err()
        {
            self.task.abort();
            eprintln!("Typesense log flush interrupted");
        }
    }
}

pub(super) fn start() -> Option<(LogLayer, LogDrain)> {
    let read = |name| std::env::var(name).unwrap_or_default().trim().to_owned();
    let raw_url = read("LOG_TYPESENSE_URL");
    let key = read("LOG_TYPESENSE_API_KEY");
    if raw_url.is_empty() && key.is_empty() {
        return None;
    }
    let url = Url::parse(&raw_url).ok().filter(|url| {
        matches!(url.scheme(), "http" | "https")
            && url.host_str().is_some()
            && url.username().is_empty()
            && url.password().is_none()
            && url.query().is_none()
            && url.fragment().is_none()
    });
    let Some(url) = url.filter(|_| !key.is_empty()) else {
        eprintln!("Typesense log export requires LOG_TYPESENSE_URL and LOG_TYPESENSE_API_KEY");
        return None;
    };
    let Ok(client) = Client::builder()
        .timeout(Duration::from_secs(2))
        .redirect(reqwest::redirect::Policy::none())
        .build()
    else {
        eprintln!("Could not initialize Typesense log export");
        return None;
    };

    let collections_url = format!("{}/collections", url.as_str().trim_end_matches('/'));
    let sink = LogSink {
        documents_url: format!("{collections_url}/{COLLECTION}/documents"),
        collections_url,
        client,
        key,
    };
    let environment = read("LOG_ENVIRONMENT");
    let environment = if environment.is_empty() {
        "development".to_owned()
    } else {
        environment
    };

    let (sender, receiver) = mpsc::channel(QUEUE_CAPACITY);
    let stop = CancellationToken::new();
    let task = tokio::spawn(sink.run(receiver, stop.clone()));
    Some((
        LogLayer {
            sender,
            environment,
            overflow_reported: AtomicBool::new(false),
        },
        LogDrain { stop, task },
    ))
}

struct LogSink {
    documents_url: String,
    collections_url: String,
    client: Client,
    key: String,
}

impl LogSink {
    async fn run(self, mut receiver: mpsc::Receiver<LogDocument>, stop: CancellationToken) {
        let mut failed = false;
        loop {
            let document = tokio::select! {
                biased;
                _ = stop.cancelled(), if !receiver.is_closed() => {
                    receiver.close();
                    continue;
                }
                document = receiver.recv() => document,
            };
            let Some(document) = document else { break };
            if self.send(&document).await {
                if failed {
                    eprintln!("Typesense log delivery resumed");
                }
                failed = false;
            } else if !failed {
                eprintln!("Typesense log delivery failed; events remain on stdout");
                failed = true;
            }
        }
    }

    async fn send(&self, document: &LogDocument) -> bool {
        let write = || self.client.post(&self.documents_url).json(document);
        let mut status = self.post(write()).await;
        if status == Some(StatusCode::NOT_FOUND) {
            let create = self.client.post(&self.collections_url).body(SCHEMA);
            let created = self.post(create).await;
            if !created.is_some_and(|code| code.is_success() || code == StatusCode::CONFLICT) {
                return false;
            }
            status = self.post(write()).await;
        }
        status.is_some_and(|code| code.is_success())
    }

    async fn post(&self, request: reqwest::RequestBuilder) -> Option<StatusCode> {
        let response = request
            .header("Content-Type", "application/json")
            .header("X-TYPESENSE-API-KEY", &self.key)
            .send()
            .await
            .ok()?;
        Some(response.status())
    }
}
