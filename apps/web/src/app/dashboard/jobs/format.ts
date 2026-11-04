// Small, dependency-free formatting helpers for the jobs dashboard. Safe on server and client.

const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

/** "3 minutes ago" / "in 2 hours". Works for past and future timestamps. */
export function relativeTime(value: string | null | undefined, now: number): string {
  const time = value ? Date.parse(value) : NaN;
  if (Number.isNaN(time)) return "—";
  const diff = time - now;
  const abs = Math.abs(diff);
  const sign = diff < 0 ? -1 : 1;
  if (abs < 10_000) return "just now";
  if (abs < 60_000) return rtf.format(sign * Math.round(abs / 1000), "second");
  if (abs < 3_600_000) return rtf.format(sign * Math.round(abs / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(sign * Math.round(abs / 3_600_000), "hour");
  return rtf.format(sign * Math.round(abs / 86_400_000), "day");
}

/** Compact form for dense tables: "just now", "3m ago", "in 2h", "4d ago". */
export function shortRelative(value: string | null | undefined, now: number): string {
  const time = value ? Date.parse(value) : NaN;
  if (Number.isNaN(time)) return "—";
  const diff = time - now;
  const abs = Math.abs(diff);
  if (abs < 10_000) return "just now";
  const unit =
    abs < 60_000
      ? `${Math.round(abs / 1000)}s`
      : abs < 3_600_000
        ? `${Math.round(abs / 60_000)}m`
        : abs < 86_400_000
          ? `${Math.round(abs / 3_600_000)}h`
          : `${Math.round(abs / 86_400_000)}d`;
  return diff < 0 ? `${unit} ago` : `in ${unit}`;
}

/** Absolute UTC timestamp, identical on server and client: "2026-11-04 14:03:12 UTC". */
export function absoluteTime(value: string | null | undefined): string {
  const time = value ? Date.parse(value) : NaN;
  if (Number.isNaN(time)) return "";
  return `${new Date(time).toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

/** Clock time for log lines: "14:03:12". */
export function clockTime(value: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "";
  return new Date(time).toISOString().slice(11, 19);
}

/** "1h 04m", "2m 05s", "12s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

/** Wall time a job has been running (or ran), or "—" if it never started. */
export function jobDuration(
  job: { startedAt: string | null; finishedAt: string | null; status: string },
  now: number
): string {
  if (!job.startedAt) return "—";
  const start = Date.parse(job.startedAt);
  const end = job.finishedAt ? Date.parse(job.finishedAt) : job.status === "running" ? now : NaN;
  return Number.isNaN(end) ? "—" : formatDuration(end - start);
}

export function formatCount(n: number | undefined): string {
  return typeof n === "number" ? n.toLocaleString("en-GB") : "—";
}
