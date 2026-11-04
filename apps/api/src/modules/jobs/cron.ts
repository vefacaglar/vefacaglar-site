/**
 * Minimal validator for standard 5-field cron expressions (UTC):
 * `minute hour day-of-month month day-of-week`.
 *
 * Each field accepts `*`, a number, a range `a-b`, a step (`*\/n`, `a/n`,
 * `a-b/n`) and comma-separated lists of those. Names (`JAN`, `MON`),
 * macros (`@daily`) and non-standard tokens (`?`, `L`, `W`, `#`) are rejected.
 * Day-of-week accepts 0-7 (0 and 7 are Sunday).
 */

const FIELD_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 7], // day of week
];

const NUMBER = /^\d{1,2}$/;

function parseNumber(value: string, min: number, max: number): number | null {
  if (!NUMBER.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

function isValidPart(part: string, min: number, max: number): boolean {
  const [base, step, ...rest] = part.split("/");
  if (rest.length > 0 || base === undefined || base === "") return false;
  if (step !== undefined && (parseNumber(step, 1, max) === null)) return false;

  if (base === "*") return true;

  const bounds = base.split("-");
  if (bounds.length === 1) {
    return parseNumber(bounds[0], min, max) !== null;
  }
  if (bounds.length === 2) {
    const from = parseNumber(bounds[0], min, max);
    const to = parseNumber(bounds[1], min, max);
    return from !== null && to !== null && from <= to;
  }
  return false;
}

/** Collapses whitespace; returns the normalized expression or `null` if invalid. */
export function normalizeCron(expression: string): string | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== FIELD_RANGES.length) return null;

  for (let i = 0; i < fields.length; i++) {
    const [min, max] = FIELD_RANGES[i];
    const parts = fields[i].split(",");
    if (!parts.every((part) => isValidPart(part, min, max))) return null;
  }
  return fields.join(" ");
}

export function isValidCron(expression: string): boolean {
  return normalizeCron(expression) !== null;
}
