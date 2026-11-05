/** Formats the normalized popularity index on a 0–100 scale. */
export function formatPopularity(value: number | null | undefined, locale: string): string | null {
  if (value == null || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value * 100);
}

/** The API returns Postgres numeric values as strings; missing times stay hidden. */
export function formatHltbHours(value: string | null | undefined, locale: string): string | null {
  if (value == null || !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0.01) return null;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(hours);
}
