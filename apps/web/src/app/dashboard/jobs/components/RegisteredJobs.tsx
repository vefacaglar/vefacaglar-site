"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../jobs.module.css";
import ds from "../../../../lib/dashboard-strings";
import { absoluteTime, jobDuration, relativeTime } from "../format";
import { runRegisteredJobAction, setRegisteredJobEnabledAction } from "../actions";
import { useJobStream } from "../hooks/useJobStream";
import { isActiveStatus, type JobSummary, type RecurringJob } from "../types";
import JobProgress from "./JobProgress";
import StatusBadge from "./StatusBadge";
import ConnectionIndicator from "./ConnectionIndicator";

const t = ds.jobs.registered;

const runsHref = (id: string) => `/dashboard/jobs?recurringJobId=${encodeURIComponent(id)}`;
const jobHref = (id: string) => `/dashboard/jobs/${id}`;

type View = { item: RecurringJob; current: JobSummary | null; last: JobSummary | null };

const newer = (a: JobSummary, b: JobSummary) => Date.parse(a.createdAt) >= Date.parse(b.createdAt);

/** Merge server data with what the live stream (or a fresh "run now") told us since. */
function toView(item: RecurringJob, live: JobSummary | undefined): View {
  const serverCurrent = item.currentJob && isActiveStatus(item.currentJob.status) ? item.currentJob : null;
  const latest = live && (!serverCurrent || live.id === serverCurrent.id || newer(live, serverCurrent)) ? live : serverCurrent;
  const current = latest && isActiveStatus(latest.status) ? latest : null;

  let last = item.lastJob && !isActiveStatus(item.lastJob.status) ? item.lastJob : null;
  if (live && !isActiveStatus(live.status) && (!last || newer(live, last))) last = live;
  return { item, current, last };
}

/** Compact live state of a queued/running run: progress, phase/message and a link to the full view. */
function LiveRun({ job, onUpdate }: { job: JobSummary; onUpdate: (job: JobSummary) => void }) {
  const { conn } = useJobStream(job.id, { startActive: true, onJob: onUpdate });
  return (
    <div className={styles.regState}>
      <div className={styles.regStateHead}>
        <StatusBadge status={job.status} cancelRequested={job.cancelRequested} />
        <ConnectionIndicator conn={conn} />
      </div>
      <JobProgress status={job.status} progress={job.progress} showDetails />
      <div className={styles.regLinks}>
        <Link href={jobHref(job.id)}>{t.watchLive}</Link>
      </div>
    </div>
  );
}

function LastRun({ job, now }: { job: JobSummary | null; now: number }) {
  if (!job) return <p className={styles.regHint}>{t.neverRun}</p>;
  return (
    <div className={styles.regLast}>
      <span className={styles.regLastLabel}>{t.lastRun}</span>
      <StatusBadge status={job.status} />
      {job.finishedAt && (
        <span className={styles.regHint} title={absoluteTime(job.finishedAt)}>
          {t.finished.replace("{when}", relativeTime(job.finishedAt, now))}
        </span>
      )}
      {job.startedAt && job.finishedAt && (
        <span className={styles.regHint}>{t.took.replace("{duration}", jobDuration(job, now))}</span>
      )}
      <Link href={jobHref(job.id)} className={styles.regInlineLink}>
        {t.viewRun}
      </Link>
    </div>
  );
}

function RegisteredJobCard({
  view,
  blockedBy,
  runningElsewhere,
  now,
  onLive,
}: {
  view: View;
  blockedBy: View | null;
  /** Any active run (for the 409 link when we have no better target). */
  runningElsewhere: JobSummary | null;
  now: number;
  onLive: (id: string, job: JobSummary) => void;
}) {
  const { item, current, last } = view;
  const [enabled, setEnabled] = useState(item.enabled);
  const [error, setError] = useState<{ message: string; link?: string } | null>(null);
  const [toggling, startToggle] = useTransition();
  const [starting, startRun] = useTransition();

  useEffect(() => setEnabled(item.enabled), [item.enabled]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startToggle(async () => {
      const res = await setRegisteredJobEnabledAction(item.id, next);
      if ("error" in res) {
        setEnabled(!next);
        setError({ message: res.error });
      }
    });
  };

  const run = () => {
    setError(null);
    startRun(async () => {
      const res = await runRegisteredJobAction(item.id);
      if ("error" in res) {
        if (res.conflict) {
          const running = current ?? blockedBy?.current ?? runningElsewhere;
          setError({
            message: t.alreadyRunning,
            link: running ? jobHref(running.id) : "/dashboard/jobs?status=processing",
          });
        } else {
          setError({ message: res.error });
        }
        return;
      }
      onLive(item.id, res.data);
    });
  };

  const runDisabled = starting || !enabled || !!current || !!blockedBy;
  const hint = !enabled
    ? t.enableToRun
    : blockedBy && !current
      ? t.busyBy.replace("{id}", blockedBy.item.id)
      : null;

  return (
    <article className={current ? styles.regCardActive : styles.regCard}>
      <div className={styles.regHead}>
        <div className={styles.regIdentity}>
          <h3 className={styles.regTitle}>{item.id}</h3>
          {item.type !== item.id && <span className={styles.sub}>{item.type}</span>}
          {item.description && <p className={styles.regDesc}>{item.description}</p>}
        </div>

        <div className={styles.regControls}>
          <label className={styles.toggleLabel}>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={t.toggleLabel.replace("{id}", item.id)}
              className={styles.toggle}
              onClick={toggle}
              disabled={toggling}
            />
            {enabled ? t.enabled : t.disabled}
          </label>
          <button type="button" className="btnAccent" onClick={run} disabled={runDisabled}>
            {starting ? t.starting : current ? t.running : t.runNow}
          </button>
        </div>
      </div>

      {(hint || error) && (
        <p className={error ? styles.inlineError : styles.regHint} role={error ? "alert" : undefined}>
          {error ? error.message : hint}{" "}
          {error?.link && <Link href={error.link}>{t.viewRunning}</Link>}
          {!error && blockedBy?.current && <Link href={jobHref(blockedBy.current.id)}>{t.watchLive}</Link>}
        </p>
      )}

      {current ? (
        <LiveRun key={current.id} job={current} onUpdate={(job) => onLive(item.id, job)} />
      ) : (
        <div className={styles.regState}>
          <LastRun job={last} now={now} />
        </div>
      )}

      <div className={styles.regFooter}>
        <Link href={runsHref(item.id)}>{t.allRuns}</Link>
      </div>
    </article>
  );
}

export default function RegisteredJobs({ items, now: serverNow }: { items: RecurringJob[]; now: number }) {
  const router = useRouter();
  const [live, setLive] = useState<Record<string, JobSummary>>({});
  const [now, setNow] = useState(serverNow);

  useEffect(() => setNow(Date.now()), [items, live]);

  const onLive = useCallback(
    (id: string, job: JobSummary) => {
      setLive((prev) => ({ ...prev, [id]: job }));
      // A run just finished: pull fresh lastJob/currentJob from the server.
      if (!isActiveStatus(job.status)) router.refresh();
    },
    [router]
  );

  if (items.length === 0) return <p className={styles.empty}>{t.empty}</p>;

  const views = items.map((item) => toView(item, live[item.id]));
  const anyActive = views.find((v) => v.current)?.current ?? null;

  return (
    <div className={styles.regList}>
      {views.map((view) => (
        <RegisteredJobCard
          key={view.item.id}
          view={view}
          blockedBy={views.find((v) => v.current && v.item.id !== view.item.id) ?? null}
          runningElsewhere={anyActive}
          now={now}
          onLive={onLive}
        />
      ))}
    </div>
  );
}
