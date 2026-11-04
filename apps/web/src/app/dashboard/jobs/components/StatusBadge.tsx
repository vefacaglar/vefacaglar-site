import React from "react";
import styles from "../jobs.module.css";
import ds from "../../../../lib/dashboard-strings";
import type { JobStatus } from "../types";

const BADGE_CLASS: Record<JobStatus, string> = {
  queued: styles.queued,
  running: styles.running,
  succeeded: styles.succeeded,
  failed: styles.failed,
  cancelled: styles.cancelled,
};

export default function StatusBadge({ status, cancelRequested }: { status: JobStatus; cancelRequested?: boolean }) {
  const label = cancelRequested && status === "running" ? ds.jobs.cancelRequested : ds.jobs.status[status] ?? status;
  return (
    <span className={`${styles.badge} ${BADGE_CLASS[status] ?? styles.queued}`}>
      {status === "running" && <span className={styles.pulse} aria-hidden="true" />}
      {label}
    </span>
  );
}
