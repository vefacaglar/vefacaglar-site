/** A playtime increase on a play log, as decimal(7,1) strings ready for `user_game_playtime_entries`. */
export interface PlaytimeIncrease {
  deltaHours: string;
  /** Null when the log had no playtime before (e.g. a freshly created log). */
  previousHours: string | null;
  newHours: string;
}

type Hours = string | number | null | undefined;

// Work in integer tenths so decimal(7,1) values subtract without float drift (e.g. 8.3 - 5.1).
const toTenths = (hours: Hours) => (hours == null || hours === "" ? 0 : Math.round(Number(hours) * 10));
const formatTenths = (tenths: number) => (tenths / 10).toFixed(1);

/**
 * Decides whether a playtime change on a log is recorded as an audit entry.
 * Only increases count: `previous` null is treated as 0, and decreases or unchanged values return null.
 */
export function playtimeIncrease(previous: Hours, next: Hours): PlaytimeIncrease | null {
  const before = toTenths(previous);
  const after = toTenths(next);
  if (after <= before) return null;
  return {
    deltaHours: formatTenths(after - before),
    previousHours: previous == null || previous === "" ? null : formatTenths(before),
    newHours: formatTenths(after),
  };
}
