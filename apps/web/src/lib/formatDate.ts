// One date format for every user-picked date on the site: "19 October 2010" /
// "19 Ekim 2010" (day, month name, year) in both languages.

/** Reads YYYY-MM-DD as a local date; `new Date(string)` would treat it as UTC and can shift the day. */
export function parseDateKey(key: string | null | undefined): Date | null {
  if (!key) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

const DAY = 86_400_000;

/**
 * How long ago a timestamp was, in the largest unit that fits: "3 days ago",
 * "11 months ago", "1 yıl önce". Empty for unreadable input.
 */
export function formatRelative(value: string | null | undefined, lang: string, now: number = Date.now()): string {
  const time = value ? Date.parse(value) : NaN;
  if (Number.isNaN(time)) return "";
  const rtf = new Intl.RelativeTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", { numeric: "auto" });
  const diff = Math.max(0, now - time);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return rtf.format(0, "second");
  if (minutes < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(diff / DAY);
  if (days < 7) return rtf.format(-days, "day");
  if (days < 30) return rtf.format(-Math.round(days / 7), "week");
  const months = Math.round(days / 30.44);
  if (months < 12) return rtf.format(-Math.max(1, months), "month");
  return rtf.format(-Math.max(1, Math.round(days / 365.25)), "year");
}

export function formatDate(value: Date | string, lang: string): string {
  const date = typeof value === "string" ? parseDateKey(value) : value;
  if (!date) return "";
  const parts = new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")} ${part("month")} ${part("year")}`;
}
