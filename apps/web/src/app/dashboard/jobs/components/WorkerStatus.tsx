import React from "react";
import styles from "../jobs.module.css";
import ds from "../../../../lib/dashboard-strings";
import { absoluteTime, relativeTime } from "../format";
import type { Worker } from "../types";

export default function WorkerStatus({ workers, now }: { workers: Worker[] | null; now: number }) {
  return (
    <div className={styles.workers}>
      <span className={styles.eyebrow}>{ds.jobs.worker.label}</span>

      {workers === null && (
        <div className={styles.workerLine}>
          <span className={styles.dotOffline} aria-hidden="true" />
          <span className={styles.workerMeta}>{ds.jobs.worker.unavailable}</span>
        </div>
      )}

      {workers?.length === 0 && (
        <div className={styles.workerLine}>
          <span className={styles.dotOffline} aria-hidden="true" />
          <span className={styles.workerMeta}>{ds.jobs.worker.none}</span>
        </div>
      )}

      {workers?.map((w) => (
        <div key={w.id} className={styles.workerLine}>
          <span className={w.online ? styles.dotOnline : styles.dotOffline} aria-hidden="true" />
          <span className={styles.workerHost}>{w.hostname}</span>
          <span className={styles.workerMeta}>
            {w.online ? ds.jobs.worker.online : ds.jobs.worker.offline}
            {" · "}
            <span title={absoluteTime(w.lastSeenAt)}>
              {ds.jobs.worker.lastSeen.replace("{when}", relativeTime(w.lastSeenAt, now))}
            </span>
            {w.version && ` · v${w.version}`}
          </span>
        </div>
      ))}
    </div>
  );
}
