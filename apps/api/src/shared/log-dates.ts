import { BadRequestError } from "./http-errors";

const calendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
});

/** Logging uses the site's calendar day, independently of the server's timezone. */
export function istanbulToday(now = new Date()): string {
  const parts = calendar.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isFutureLogDate(value: string, now = new Date()): boolean {
  return value > istanbulToday(now);
}

/** Unchanged legacy dates remain editable; a new calendar date cannot be in the future. */
export function validateLogDate(
  value: string | null | undefined,
  previous?: string | null,
  now = new Date(),
  invalidKey = "err_log_date",
): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestError(invalidKey);
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  parsed.setUTCHours(0, 0, 0, 0);
  if (year < 1 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new BadRequestError(invalidKey);
  }
  if (value !== previous && isFutureLogDate(value, now)) throw new BadRequestError("err_log_future_date");
  return value;
}
