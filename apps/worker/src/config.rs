use std::path::PathBuf;

/// Meilisearch connection settings (`MEILISEARCH_URL`, `MEILISEARCH_API_KEY`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MeilisearchConfig {
    /// Base URL without a trailing slash, e.g. `http://meilisearch:7700`.
    pub url: String,
    /// Sent as a Bearer token; may be empty for a local server without a key.
    pub api_key: String,
}

impl MeilisearchConfig {
    /// Builds the config from raw env values. Returns `None` when the URL is
    /// missing or is not an absolute http(s) URL (search is then disabled).
    pub fn from_values(url: Option<String>, api_key: Option<String>) -> Option<Self> {
        let url = url?.trim().trim_end_matches('/').to_string();
        let parsed = reqwest::Url::parse(&url).ok()?;
        if !matches!(parsed.scheme(), "http" | "https")
            || parsed.host_str().is_none()
            || parsed.query().is_some()
            || parsed.fragment().is_some()
        {
            return None;
        }
        Some(Self {
            url,
            api_key: api_key.unwrap_or_default().trim().to_string(),
        })
    }
}

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub db_pool_max: u32,
    pub worker_id: String,
    pub hostname: String,
    pub health_file: PathBuf,
    pub control_file: Option<PathBuf>,
    pub control_status_file: PathBuf,
    pub meilisearch: Option<MeilisearchConfig>,
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

pub fn control_status_file_from_env() -> PathBuf {
    env_opt("WORKER_CONTROL_STATUS_FILE")
        .map(PathBuf::from)
        .unwrap_or_else(|| health_file_from_env().with_extension("state"))
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let database_url = env_opt("DATABASE_URL").ok_or(ConfigError::MissingDatabaseUrl)?;
        let hostname = hostname();
        let worker_id =
            env_opt("WORKER_ID").unwrap_or_else(|| format!("{}-{}", hostname, std::process::id()));
        let db_pool_max = match env_opt("WORKER_DB_POOL_MAX") {
            Some(raw) => raw.parse().map_err(ConfigError::InvalidPoolSize)?,
            None => 5,
        };
        Ok(Self {
            database_url,
            db_pool_max,
            worker_id,
            hostname,
            health_file: health_file_from_env(),
            control_file: env_opt("WORKER_CONTROL_FILE").map(PathBuf::from),
            control_status_file: control_status_file_from_env(),
            meilisearch: MeilisearchConfig::from_values(
                env_opt("MEILISEARCH_URL"),
                env_opt("MEILISEARCH_API_KEY"),
            ),
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("DATABASE_URL is required")]
    MissingDatabaseUrl,
    #[error("WORKER_DB_POOL_MAX must be an unsigned integer")]
    InvalidPoolSize(#[source] std::num::ParseIntError),
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s(v: &str) -> Option<String> {
        Some(v.to_string())
    }

    #[test]
    fn meilisearch_disabled_without_a_valid_url() {
        assert_eq!(MeilisearchConfig::from_values(None, s("k")), None);
        assert_eq!(
            MeilisearchConfig::from_values(s("meilisearch:7700"), s("k")),
            None
        );
        assert_eq!(MeilisearchConfig::from_values(s("ftp://m"), s("k")), None);
    }

    #[test]
    fn meilisearch_url_is_normalized_and_key_is_optional() {
        let config = MeilisearchConfig::from_values(s(" http://meilisearch:7700/ "), None).unwrap();
        assert_eq!(config.url, "http://meilisearch:7700");
        assert_eq!(config.api_key, "");
        let keyed = MeilisearchConfig::from_values(s("https://search.example"), s("k")).unwrap();
        assert_eq!(keyed.api_key, "k");
    }
}
