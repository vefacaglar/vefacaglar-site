use std::path::PathBuf;

use anyhow::{Context, Result};

/// Typesense connection settings, mirroring the API's `readTypesenseConfig`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TypesenseConfig {
    pub host: String,
    pub port: u16,
    pub protocol: String,
    pub api_key: String,
}

impl TypesenseConfig {
    /// Builds the config from raw env values. Returns `None` when the host or
    /// API key is missing (search is then disabled, as in the API).
    pub fn from_values(
        host: Option<String>,
        port: Option<String>,
        protocol: Option<String>,
        api_key: Option<String>,
    ) -> Option<Self> {
        let host = host.filter(|v| !v.trim().is_empty())?;
        let api_key = api_key.filter(|v| !v.trim().is_empty())?;
        let protocol = if protocol.as_deref() == Some("http") {
            "http"
        } else {
            "https"
        };
        let default_port = if protocol == "https" { 443 } else { 80 };
        let port = match port {
            Some(raw) if !raw.trim().is_empty() => raw.trim().parse().unwrap_or(443),
            _ => default_port,
        };
        Some(Self {
            host: host.trim().to_string(),
            port,
            protocol: protocol.to_string(),
            api_key,
        })
    }

    pub fn base_url(&self) -> String {
        format!("{}://{}:{}", self.protocol, self.host, self.port)
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub db_pool_max: u32,
    pub worker_id: String,
    pub hostname: String,
    pub health_file: PathBuf,
    pub typesense: Option<TypesenseConfig>,
}

fn env_opt(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|v| !v.is_empty())
}

pub fn hostname() -> String {
    gethostname::gethostname().to_string_lossy().into_owned()
}

/// Default health file location; shared by the worker and `--healthcheck`.
pub fn health_file_from_env() -> PathBuf {
    env_opt("WORKER_HEALTH_FILE")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join("worker-health"))
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let database_url = env_opt("DATABASE_URL").context("DATABASE_URL is required")?;
        let hostname = hostname();
        let worker_id =
            env_opt("WORKER_ID").unwrap_or_else(|| format!("{}-{}", hostname, std::process::id()));
        let db_pool_max = match env_opt("WORKER_DB_POOL_MAX") {
            Some(raw) => raw
                .parse()
                .context("WORKER_DB_POOL_MAX must be a positive integer")?,
            None => 5,
        };
        Ok(Self {
            database_url,
            db_pool_max,
            worker_id,
            hostname,
            health_file: health_file_from_env(),
            typesense: TypesenseConfig::from_values(
                env_opt("TYPESENSE_HOST"),
                env_opt("TYPESENSE_PORT"),
                env_opt("TYPESENSE_PROTOCOL"),
                env_opt("TYPESENSE_API_KEY"),
            ),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &str) -> Option<String> {
        Some(v.to_string())
    }

    #[test]
    fn typesense_disabled_without_host_or_key() {
        assert_eq!(TypesenseConfig::from_values(None, None, None, s("k")), None);
        assert_eq!(TypesenseConfig::from_values(s("h"), None, None, None), None);
    }

    #[test]
    fn typesense_defaults_follow_protocol() {
        let https = TypesenseConfig::from_values(s("ts"), None, None, s("k")).unwrap();
        assert_eq!(https.base_url(), "https://ts:443");
        let http = TypesenseConfig::from_values(s("ts"), None, s("http"), s("k")).unwrap();
        assert_eq!(http.base_url(), "http://ts:80");
        let explicit = TypesenseConfig::from_values(s("ts"), s("8108"), s("http"), s("k")).unwrap();
        assert_eq!(explicit.base_url(), "http://ts:8108");
    }
}
