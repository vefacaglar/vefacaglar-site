import React from "react";
import styles from "./JobProgress.module.css";
import ds from "../../../../lib/dashboard-strings";
import { formatCount } from "../format";
import type { JobProgress as Progress, JobStatus } from "../types";

const TONE: Record<JobStatus, string> = {
  queued: styles.queued,
  running: styles.running,
  succeeded: styles.succeeded,
  failed: styles.failed,
  cancelled: styles.cancelled,
};

type Props = {
  status: JobStatus;
  progress: Progress | null | undefined;
  /** `compact` for table rows and cards, `large` for the detail page. */
  variant?: "compact" | "large";
  /** Show phase and message under the bar (defaults to true for `large`). */
  showDetails?: boolean;
};

type BarState =
  | { kind: "determinate"; value: number; max: number; percent: number }
  | { kind: "indeterminate" }
  | { kind: "static"; value: number; max: number };

function barState(status: JobStatus, p: Progress): BarState {
  const total = typeof p.total === "number" && p.total > 0 ? p.total : null;
  const processed = typeof p.processed === "number" ? Math.max(0, p.processed) : 0;

  if (status === "succeeded") {
    return total ? { kind: "determinate", value: total, max: total, percent: 100 } : { kind: "static", value: 1, max: 1 };
  }
  if (total) {
    const value = Math.min(processed, total);
    return { kind: "determinate", value, max: total, percent: Math.floor((value / total) * 100) };
  }
  if (status === "running") return { kind: "indeterminate" };
  // Failed/cancelled without counters: a full, dimmed "stopped" bar. Queued: empty.
  return { kind: "static", value: status === "queued" ? 0 : 1, max: 1 };
}

/**
 * Job progress on a styled native <progress> (value/max attributes, no inline
 * styles). Determinate when the job reports a total, an animated indeterminate
 * sweep while running without one, full for succeeded and a frozen accent bar
 * for failed/cancelled.
 */
export default function JobProgress({ status, progress, variant = "compact", showDetails }: Props) {
  const p = progress ?? {};
  const state = barState(status, p);
  const large = variant === "large";
  const details = showDetails ?? large;
  const stoppedWithoutTotal = state.kind === "static" && (status === "failed" || status === "cancelled");

  const barClass = [
    large ? styles.barLarge : styles.bar,
    TONE[status] ?? styles.queued,
    stoppedWithoutTotal ? styles.stopped : "",
  ].join(" ");

  const fallbackLabel =
    status === "running"
      ? ds.jobs.progress.working
      : status === "succeeded"
        ? ds.jobs.progress.done
        : status === "queued"
          ? ds.jobs.progress.waiting
          : ds.jobs.progress.stopped;

  const counts =
    state.kind === "determinate" ? (
      <span className={styles.counts}>
        <span className={styles.num}>{formatCount(state.value)}</span> / {formatCount(state.max)}
        {" · "}
        <span className={styles.percent}>{state.percent}%</span>
      </span>
    ) : (
      <span className={styles.counts}>{fallbackLabel}</span>
    );

  const bar =
    state.kind === "indeterminate" ? (
      <progress className={barClass} aria-label={ds.jobs.progress.label} />
    ) : (
      <progress className={barClass} value={state.value} max={state.max} aria-label={ds.jobs.progress.label} />
    );

  return (
    <div className={large ? styles.rootLarge : styles.root}>
      {bar}
      <div className={styles.meta}>
        {p.phase ? (
          <span className={details ? styles.phase : styles.phaseCompact} title={p.phase}>
            {p.phase}
          </span>
        ) : (
          <span />
        )}
        {counts}
      </div>
      {details && p.message && <p className={styles.message}>{p.message}</p>}
    </div>
  );
}
