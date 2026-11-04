import React from "react";
import Link from "next/link";
import styles from "../jobs.module.css";
import ds from "../../../../lib/dashboard-strings";
import { absoluteTime, jobDuration, shortRelative } from "../format";
import type { JobSummary } from "../types";
import StatusBadge from "./StatusBadge";
import JobProgress from "./JobProgress";

function When({ value, now }: { value: string | null; now: number }) {
  return <span title={absoluteTime(value)}>{shortRelative(value, now)}</span>;
}

export default function JobsTable({ jobs, now }: { jobs: JobSummary[]; now: number }) {
  const t = ds.jobs.table;
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>{t.job}</th>
            <th className={styles.th}>{t.status}</th>
            <th className={styles.th}>{t.progress}</th>
            <th className={styles.th}>{t.worker}</th>
            <th className={styles.th}>{t.attempts}</th>
            <th className={styles.th}>{t.created}</th>
            <th className={styles.th}>{t.finished}</th>
            <th className={styles.thRight}>{t.duration}</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const waitingRetry =
              job.status === "queued" && job.attempts > 0 && job.runAt && Date.parse(job.runAt) > now;
            return (
              <tr key={job.id} className={styles.tr}>
                <td className={styles.td}>
                  <Link href={`/dashboard/jobs/${job.id}`} className={styles.typeLink}>
                    {job.type}
                  </Link>
                  <span className={styles.sub}>
                    {job.id.slice(0, 8)}
                    {job.recurringJobId && job.recurringJobId !== job.type && ` · ${job.recurringJobId}`}
                  </span>
                </td>
                <td className={styles.td}>
                  <StatusBadge status={job.status} cancelRequested={job.cancelRequested} />
                  {waitingRetry && (
                    <span className={styles.sub}>
                      {ds.jobs.retryAt.replace("{when}", shortRelative(job.runAt, now))}
                    </span>
                  )}
                </td>
                <td className={styles.tdWide}>
                  <JobProgress status={job.status} progress={job.progress} />
                </td>
                <td className={styles.tdMuted}>
                  {job.lockedBy ? (
                    <span className={styles.worker} title={ds.jobs.runningOn.replace("{worker}", job.lockedBy)}>
                      {job.lockedBy}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className={styles.tdMuted}>
                  {job.attempts} / {job.maxAttempts}
                </td>
                <td className={styles.tdMuted}>
                  <When value={job.createdAt} now={now} />
                </td>
                <td className={styles.tdMuted}>
                  <When value={job.finishedAt} now={now} />
                </td>
                <td className={styles.tdRight}>{jobDuration(job, now)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
