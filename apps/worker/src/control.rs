//! Deployment admission control. Draining never cancels a JobContext.

use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Standby,
    Active,
    Drain,
}

impl Mode {
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim() {
            "standby" => Some(Self::Standby),
            "active" => Some(Self::Active),
            "drain" => Some(Self::Drain),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Standby => "standby",
            Self::Active => "active",
            Self::Drain => "drain",
        }
    }

    /// Once retired, a process cannot be reactivated by a later file change.
    pub fn next(self, requested: Self) -> Self {
        if self == Self::Drain { self } else { requested }
    }
}

/// Unmanaged/local workers retain their active default. Managed workers fail
/// closed if their durable control file disappears or contains invalid data.
pub fn requested(path: Option<&Path>) -> Mode {
    match path {
        None => Mode::Active,
        Some(path) => std::fs::read_to_string(path)
            .ok()
            .and_then(|raw| Mode::parse(&raw))
            .unwrap_or(Mode::Standby),
    }
}

pub fn write_status(path: &Path, mode: Mode) -> std::io::Result<()> {
    let temporary = path.with_extension("tmp");
    std::fs::write(&temporary, mode.as_str())?;
    std::fs::rename(temporary, path)
}

pub fn read_status(path: &Path) -> Result<Mode, String> {
    let raw =
        std::fs::read_to_string(path).map_err(|_| "worker status is unavailable".to_string())?;
    Mode::parse(&raw).ok_or_else(|| "worker status is invalid".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn managed_control_fails_closed_and_drain_is_sticky() {
        let directory =
            std::env::temp_dir().join(format!("worker-control-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&directory).unwrap();
        let path = directory.join("mode");
        assert_eq!(requested(None), Mode::Active);
        assert_eq!(requested(Some(&path)), Mode::Standby);
        for mode in [Mode::Standby, Mode::Active, Mode::Drain] {
            std::fs::write(&path, mode.as_str()).unwrap();
            assert_eq!(requested(Some(&path)), mode);
            write_status(&directory.join("status"), mode).unwrap();
            assert_eq!(read_status(&directory.join("status")).unwrap(), mode);
        }
        std::fs::write(&path, "unrecognized").unwrap();
        assert_eq!(requested(Some(&path)), Mode::Standby);
        assert_eq!(Mode::Drain.next(Mode::Active), Mode::Drain);
        assert_eq!(Mode::Drain.next(Mode::Standby), Mode::Drain);
        std::fs::remove_dir_all(directory).unwrap();
    }
}
