use std::time::Duration;

/// Base delay of the first retry.
pub const RETRY_BASE: Duration = Duration::from_secs(30);
/// Upper bound so a misconfigured `max_attempts` cannot overflow the delay.
pub const RETRY_MAX: Duration = Duration::from_secs(24 * 60 * 60);

/// Retry delay after a failed attempt: `30s * 2^(attempts-1)`, where
/// `attempts` is the attempt that just failed (1-based, as stored in `jobs`).
pub fn retry_delay(attempts: i32) -> Duration {
    let exponent = attempts.saturating_sub(1).clamp(0, 31) as u32;
    let secs = RETRY_BASE.as_secs().saturating_mul(1u64 << exponent);
    Duration::from_secs(secs).min(RETRY_MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn doubles_from_thirty_seconds() {
        assert_eq!(retry_delay(1), Duration::from_secs(30));
        assert_eq!(retry_delay(2), Duration::from_secs(60));
        assert_eq!(retry_delay(3), Duration::from_secs(120));
        assert_eq!(retry_delay(4), Duration::from_secs(240));
    }

    #[test]
    fn clamps_out_of_range_attempts() {
        assert_eq!(retry_delay(0), Duration::from_secs(30));
        assert_eq!(retry_delay(-5), Duration::from_secs(30));
        assert_eq!(retry_delay(40), RETRY_MAX);
        assert_eq!(retry_delay(i32::MAX), RETRY_MAX);
    }
}
