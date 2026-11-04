//! File-based liveness probe used by the Docker healthcheck.
//!
//! After every successful `workers` heartbeat the worker writes the current
//! unix time to the health file. `worker --healthcheck` succeeds when that
//! timestamp is recent, so the probe proves both that the process loop is alive
//! and that it can reach Postgres, without opening a DB connection itself.

use std::path::Path;

use chrono::Utc;

/// Same window the dashboard uses for "online".
pub const MAX_AGE_SECS: i64 = 30;

pub fn write_heartbeat(path: &Path) -> std::io::Result<()> {
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, Utc::now().timestamp().to_string())?;
    std::fs::rename(&tmp, path)
}

/// Returns `Ok(age_secs)` when the heartbeat is fresh, otherwise an error message.
pub fn check(path: &Path, now_unix: i64) -> Result<i64, String> {
    let raw = std::fs::read_to_string(path)
        .map_err(|e| format!("cannot read {}: {e}", path.display()))?;
    let written: i64 = raw
        .trim()
        .parse()
        .map_err(|_| format!("invalid heartbeat in {}", path.display()))?;
    let age = now_unix - written;
    if (0..=MAX_AGE_SECS).contains(&age) || (-5..0).contains(&age) {
        Ok(age.max(0))
    } else {
        Err(format!("last heartbeat {age}s ago"))
    }
}

pub fn remove(path: &Path) {
    let _ = std::fs::remove_file(path);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresh_and_stale_heartbeats() {
        let dir = std::env::temp_dir().join(format!("worker-health-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("health");
        assert!(check(&file, 0).is_err());

        write_heartbeat(&file).unwrap();
        let now = Utc::now().timestamp();
        assert!(check(&file, now).is_ok());
        assert!(check(&file, now + MAX_AGE_SECS + 2).is_err());

        std::fs::write(&file, "garbage").unwrap();
        assert!(check(&file, now).is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
