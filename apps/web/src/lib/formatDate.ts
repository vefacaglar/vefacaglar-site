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
