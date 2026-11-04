//! Standard 5-field cron expressions in UTC, accepting exactly what the API's
//! validator (`apps/api/src/modules/jobs/cron.ts`) accepts: `*`, numbers,
//! ranges `a-b`, steps (`*/n`, `a/n`, `a-b/n`) and comma lists. Day-of-week is
//! 0-7 (0 and 7 are Sunday). Names, macros, `?`, `L`, `W` and `#` are rejected.
//!
//! Day matching follows Vixie cron: when both day-of-month and day-of-week are
//! restricted (neither field starts with `*`), a day matches if *either* does.

use chrono::{DateTime, Datelike, Duration, NaiveDate, TimeZone, Timelike, Utc};

/// `[min, max]` per field: minute, hour, day-of-month, month, day-of-week.
const FIELD_RANGES: [(u32, u32); 5] = [(0, 59), (0, 23), (1, 31), (1, 12), (0, 7)];

/// Give up searching after this many years (e.g. `0 0 31 2 *` never matches).
const MAX_SEARCH_YEARS: i32 = 5;

#[derive(Debug, thiserror::Error)]
#[error("invalid cron expression {expression:?}: {reason}")]
pub struct InvalidCron {
    pub expression: String,
    pub reason: String,
}

/// A parsed cron expression. Each field is a bitset of allowed values.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Schedule {
    minutes: u64,
    hours: u64,
    days_of_month: u64,
    months: u64,
    /// Bit 0 = Sunday ... bit 6 = Saturday (7 is folded into 0).
    days_of_week: u64,
    dom_star: bool,
    dow_star: bool,
}

/// JavaScript's `\s` set, so splitting matches the API's `split(/\s+/)`.
fn is_js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{0B}' | '\u{0C}' | '\r' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

/// Mirrors the API's `parseNumber`: 1-2 ASCII digits within `[min, max]`.
fn parse_number(value: &str, min: u32, max: u32) -> Option<u32> {
    if value.is_empty() || value.len() > 2 || !value.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let n: u32 = value.parse().ok()?;
    (min..=max).contains(&n).then_some(n)
}

/// Parses one comma-separated part into a bitset (mirrors `isValidPart`).
fn parse_part(part: &str, min: u32, max: u32) -> Option<u64> {
    let mut pieces = part.split('/');
    let base = pieces.next().filter(|b| !b.is_empty())?;
    let step = match pieces.next() {
        Some(raw) => parse_number(raw, 1, max)?,
        None => 1,
    };
    if pieces.next().is_some() {
        return None;
    }
    let has_step = part.contains('/');
    let (from, to) = if base == "*" {
        (min, max)
    } else {
        let bounds: Vec<&str> = base.split('-').collect();
        match bounds.as_slice() {
            [single] => {
                let n = parse_number(single, min, max)?;
                // Vixie: `a/n` means `a-max/n`.
                (n, if has_step { max } else { n })
            }
            [a, b] => {
                let from = parse_number(a, min, max)?;
                let to = parse_number(b, min, max)?;
                if from > to {
                    return None;
                }
                (from, to)
            }
            _ => return None,
        }
    };
    let mut bits = 0u64;
    let mut v = from;
    while v <= to {
        bits |= 1 << v;
        v += step;
    }
    Some(bits)
}

fn parse_field(field: &str, min: u32, max: u32) -> Option<u64> {
    field
        .split(',')
        .map(|part| parse_part(part, min, max))
        .try_fold(0u64, |acc, bits| bits.map(|b| acc | b))
}

/// Returns the whitespace-normalized expression, or `None` if the API would
/// reject it. Same contract as the API's `normalizeCron`.
pub fn normalize(expression: &str) -> Option<String> {
    Schedule::parse(expression).ok()?;
    Some(fields(expression).join(" "))
}

fn fields(expression: &str) -> Vec<&str> {
    expression
        .split(is_js_whitespace)
        .filter(|f| !f.is_empty())
        .collect()
}

impl Schedule {
    pub fn parse(expression: &str) -> Result<Self, InvalidCron> {
        let invalid = |reason: &str| InvalidCron {
            expression: expression.to_string(),
            reason: reason.to_string(),
        };
        let fields = fields(expression);
        if fields.len() != FIELD_RANGES.len() {
            return Err(invalid("expected 5 fields"));
        }
        let mut sets = [0u64; 5];
        for (i, field) in fields.iter().enumerate() {
            let (min, max) = FIELD_RANGES[i];
            sets[i] = parse_field(field, min, max)
                .ok_or_else(|| invalid(&format!("invalid field {}: {field:?}", i + 1)))?;
        }
        let mut dow = sets[4];
        if dow & (1 << 7) != 0 {
            dow = (dow & !(1 << 7)) | 1;
        }
        Ok(Self {
            minutes: sets[0],
            hours: sets[1],
            days_of_month: sets[2],
            months: sets[3],
            days_of_week: dow,
            dom_star: fields[2].starts_with('*'),
            dow_star: fields[4].starts_with('*'),
        })
    }

    fn day_matches(&self, date: NaiveDate) -> bool {
        let dom = self.days_of_month & (1 << date.day()) != 0;
        let dow = self.days_of_week & (1 << date.weekday().num_days_from_sunday()) != 0;
        if self.dom_star || self.dow_star {
            dom && dow
        } else {
            dom || dow
        }
    }

    /// The first matching minute strictly after `after`.
    pub fn next_after(&self, after: DateTime<Utc>) -> Result<DateTime<Utc>, InvalidCron> {
        let start = after
            .with_second(0)
            .and_then(|t| t.with_nanosecond(0))
            .unwrap_or(after)
            + Duration::minutes(1);
        let limit_year = start.year() + MAX_SEARCH_YEARS;
        let mut t = start;
        while t.year() <= limit_year {
            if self.months & (1 << t.month()) == 0 {
                // First day of the next month.
                let (y, m) = if t.month() == 12 {
                    (t.year() + 1, 1)
                } else {
                    (t.year(), t.month() + 1)
                };
                t = Utc.with_ymd_and_hms(y, m, 1, 0, 0, 0).unwrap();
                continue;
            }
            if !self.day_matches(t.date_naive()) {
                t = (t.date_naive() + Duration::days(1))
                    .and_hms_opt(0, 0, 0)
                    .unwrap()
                    .and_utc();
                continue;
            }
            if self.hours & (1 << t.hour()) == 0 {
                t = t.with_minute(0).unwrap() + Duration::hours(1);
                continue;
            }
            if self.minutes & (1 << t.minute()) == 0 {
                t += Duration::minutes(1);
                continue;
            }
            return Ok(t);
        }
        Err(InvalidCron {
            expression: format!("{self:?}"),
            reason: format!("no matching time within {MAX_SEARCH_YEARS} years"),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(y: i32, mo: u32, d: u32, h: u32, mi: u32, s: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(y, mo, d, h, mi, s).unwrap()
    }

    /// Shared examples with the API validator (apps/api/src/modules/jobs/cron.ts).
    const VALID: &[&str] = &[
        "0 3 * * *",
        "*/15 * * * *",
        "0 0 1 1 *",
        "5,10,15 1-5 * * 1-5",
        "0 */2 1-15/3 * 0",
        "59 23 31 12 7",
        "0 0 * * 0-7",
        "10/5 * * * *",
        "  0   3  *  *  *  ",
    ];

    const INVALID: &[&str] = &[
        "",
        "0 3 * *",
        "0 0 3 * * *",
        "60 * * * *",
        "* 24 * * *",
        "* * 0 * *",
        "* * 32 * *",
        "* * * 13 *",
        "* * * * 8",
        "*/0 * * * *",
        "*/60 * * * *",
        "5-1 * * * *",
        "1-2-3 * * * *",
        "*/5/2 * * * *",
        "/5 * * * *",
        "1, * * * *",
        "001 * * * *",
        "@daily",
        "0 3 * JAN *",
        "0 3 * * MON",
        "0 3 ? * *",
        "0 3 L * *",
        "0 3 15W * *",
        "0 3 * * 1#2",
        "-1 * * * *",
        "a b c d e",
    ];

    #[test]
    fn accepts_and_rejects_like_the_api() {
        for expr in VALID {
            assert!(Schedule::parse(expr).is_ok(), "should accept {expr:?}");
        }
        for expr in INVALID {
            assert!(Schedule::parse(expr).is_err(), "should reject {expr:?}");
        }
        assert_eq!(
            normalize("  0   3  *  *  *  ").as_deref(),
            Some("0 3 * * *")
        );
        assert_eq!(normalize("0 3 * *"), None);
    }

    #[test]
    fn daily_at_three() {
        let s = Schedule::parse("0 3 * * *").unwrap();
        assert_eq!(
            s.next_after(at(2026, 1, 1, 2, 59, 59)).unwrap(),
            at(2026, 1, 1, 3, 0, 0)
        );
        // Strictly after: exactly 03:00 moves to the next day.
        assert_eq!(
            s.next_after(at(2026, 1, 1, 3, 0, 0)).unwrap(),
            at(2026, 1, 2, 3, 0, 0)
        );
        assert_eq!(
            s.next_after(at(2026, 12, 31, 4, 0, 0)).unwrap(),
            at(2027, 1, 1, 3, 0, 0)
        );
    }

    #[test]
    fn steps_lists_and_ranges() {
        let every_15 = Schedule::parse("*/15 * * * *").unwrap();
        assert_eq!(
            every_15.next_after(at(2026, 3, 1, 10, 7, 0)).unwrap(),
            at(2026, 3, 1, 10, 15, 0)
        );
        assert_eq!(
            every_15.next_after(at(2026, 3, 1, 10, 59, 0)).unwrap(),
            at(2026, 3, 1, 11, 0, 0)
        );
        // `10/5` = 10,15,...,55.
        let from_ten = Schedule::parse("10/5 * * * *").unwrap();
        assert_eq!(
            from_ten.next_after(at(2026, 3, 1, 10, 56, 0)).unwrap(),
            at(2026, 3, 1, 11, 10, 0)
        );
        let list = Schedule::parse("0 9,17 * * *").unwrap();
        assert_eq!(
            list.next_after(at(2026, 3, 1, 9, 0, 0)).unwrap(),
            at(2026, 3, 1, 17, 0, 0)
        );
    }

    #[test]
    fn day_of_week_with_sunday_as_zero_or_seven() {
        // 2026-03-01 is a Sunday.
        let monday = Schedule::parse("30 6 * * 1").unwrap();
        assert_eq!(
            monday.next_after(at(2026, 3, 1, 12, 0, 0)).unwrap(),
            at(2026, 3, 2, 6, 30, 0)
        );
        let sunday0 = Schedule::parse("0 0 * * 0").unwrap();
        let sunday7 = Schedule::parse("0 0 * * 7").unwrap();
        assert_eq!(sunday0, sunday7);
        assert_eq!(
            sunday7.next_after(at(2026, 3, 2, 0, 0, 0)).unwrap(),
            at(2026, 3, 8, 0, 0, 0)
        );
        let weekdays = Schedule::parse("0 8 * * 1-5").unwrap();
        assert_eq!(
            weekdays.next_after(at(2026, 3, 6, 9, 0, 0)).unwrap(),
            at(2026, 3, 9, 8, 0, 0)
        );
    }

    #[test]
    fn day_of_month_and_week_use_vixie_or_semantics() {
        // The 15th OR any Monday.
        let s = Schedule::parse("0 0 15 * 1").unwrap();
        assert_eq!(
            s.next_after(at(2026, 3, 1, 0, 0, 0)).unwrap(),
            at(2026, 3, 2, 0, 0, 0)
        );
        assert_eq!(
            s.next_after(at(2026, 3, 13, 0, 0, 0)).unwrap(),
            at(2026, 3, 15, 0, 0, 0)
        );
        // `*` in day-of-week: only the day of month counts.
        let first = Schedule::parse("0 0 1 * *").unwrap();
        assert_eq!(
            first.next_after(at(2026, 3, 1, 0, 0, 0)).unwrap(),
            at(2026, 4, 1, 0, 0, 0)
        );
    }

    #[test]
    fn leap_days_and_impossible_dates() {
        let leap = Schedule::parse("0 0 29 2 *").unwrap();
        assert_eq!(
            leap.next_after(at(2026, 1, 1, 0, 0, 0)).unwrap(),
            at(2028, 2, 29, 0, 0, 0)
        );
        let never = Schedule::parse("0 0 31 2 *").unwrap();
        assert!(never.next_after(at(2026, 1, 1, 0, 0, 0)).is_err());
    }
}
