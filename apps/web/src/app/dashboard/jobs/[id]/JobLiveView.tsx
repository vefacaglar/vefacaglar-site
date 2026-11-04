"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import styles from "../jobs.module.css";
import ds from "../../../../lib/dashboard-strings";
import { useConfirm } from "../../components/ConfirmProvider";
import { cancelJobAction, retryJobAction } from "../actions";
import { absoluteTime, jobDuration, relativeTime } from "../format";
import { useJobStream } from "../hooks/useJobStream";
import { LOG_PAGE_SIZE, isActiveStatus, type JobDetail, type JobLog, type JobSummary } from "../types";
import JobProgress from "../components/JobProgress";
import StatusBadge from "../components/StatusBadge";
import ConnectionIndicator from "../components/ConnectionIndicator";
import LogConsole from "./LogConsole";

const t = ds.jobs.detail;
/** Rendered log lines are capped; older ones are dropped from the top. */
const MAX_LINES = 2000;

type LogState = { lines: JobLog[]; hidden: number };

function appendLines(prev: LogState, incoming: JobLog[], dropped: number): LogState {
  const all = prev.lines.concat(incoming);
  const over = Math.max(0, all.length - MAX_LINES);
  return { lines: over ? all.slice(over) : all, hidden: prev.hidden + dropped + over };
}

function Fact({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>
        {value}
        {sub && <span className={styles.factSub}>{sub}</span>}
      </dd>
    </div>
  );
}

function TimeFact({ label, value, now }: { label: string; value: string | null; now: number }) {
  return <Fact label={label} value={value ? relativeTime(value, now) : "—"} sub={absoluteTime(value) || undefined} />;
}

export default function JobLiveView({ initial, serverNow }: { initial: JobDetail; serverNow: number }) {
  const confirm = useConfirm();
  const [job, setJob] = useState<JobSummary>(initial.job);
  const [log, setLog] = useState<LogState>(() => appendLines({ lines: [], hidden: 0 }, initial.logs, 0));
  const [now, setNow] = useState(serverNow);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fadeAfterId] = useState(() => initial.logs.at(-1)?.id ?? -1);

  // ---- Batch stream updates into one render per animation frame -------------
  const queued = useRef<{ job: JobSummary | null; logs: JobLog[]; dropped: number }>({ job: null, logs: [], dropped: 0 });
  const frame = useRef<number | null>(null);

  const flush = useCallback(() => {
    frame.current = null;
    const { job: nextJob, logs, dropped } = queued.current;
    queued.current = { job: null, logs: [], dropped: 0 };
    if (nextJob) {
      setJob(nextJob);
      setNow(Date.now());
    }
    if (logs.length || dropped) setLog((prev) => appendLines(prev, logs, dropped));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (frame.current === null) frame.current = requestAnimationFrame(flush);
  }, [flush]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

  const onJob = useCallback(
    (next: JobSummary) => {
      queued.current.job = next;
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const onLogs = useCallback(
    (lines: JobLog[]) => {
      const q = queued.current;
      q.logs.push(...lines);
      // Background tabs pause animation frames; keep the queue bounded meanwhile.
      if (q.logs.length > MAX_LINES) {
        const extra = q.logs.length - MAX_LINES;
        q.logs.splice(0, extra);
        q.dropped += extra;
      }
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const { conn, error: liveError, restart } = useJobStream(initial.job.id, {
    initialLastLogId: initial.logs.at(-1)?.id ?? null,
    startActive: isActiveStatus(initial.job.status),
    catchUp: initial.logs.length >= LOG_PAGE_SIZE,
    onJob,
    onLogs,
  });

  // Relative times start from the server clock; tick with the browser clock while active.
  const active = isActiveStatus(job.status);
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  // ---- Actions -----------------------------------------------------------------
  const runAction = (action: typeof cancelJobAction) => {
    setActionError(null);
    startTransition(async () => {
      const res = await action(job.id);
      if ("error" in res) {
        setActionError(res.error);
        return;
      }
      setJob(res.data);
      setNow(Date.now());
      // A retried job is queued again: open a new live session if the last one ended.
      if (conn === "ended" && isActiveStatus(res.data.status)) restart();
    });
  };

  const onCancel = async () => {
    const ok = await confirm(t.cancelConfirm, {
      title: t.cancelTitle,
      confirmText: t.cancelConfirmText,
      cancelText: t.cancelDismiss,
    });
    if (ok) runAction(cancelJobAction);
  };

  const canCancel = active && !job.cancelRequested;
  const canRetry = job.status === "failed" || job.status === "cancelled";

  return (
    <>
      <div className={styles.detailHeader}>
        <div>
          <h1 className={styles.detailTitle}>
            {job.type}
            <StatusBadge status={job.status} cancelRequested={job.cancelRequested} />
            <ConnectionIndicator conn={conn} />
          </h1>
          <div className={styles.detailId}>
            {job.id}
            {job.status === "running" && job.lockedBy && (
              <span className={styles.runningOn}>{ds.jobs.runningOn.replace("{worker}", job.lockedBy)}</span>
            )}
          </div>
        </div>

        <div>
          <div className={styles.rowActions}>
            {active && (
              <button type="button" className="btnGhost" onClick={onCancel} disabled={!canCancel || pending}>
                {job.cancelRequested ? ds.jobs.cancelRequested : pending ? t.cancelling : t.cancel}
              </button>
            )}
            {canRetry && (
              <button
                type="button"
                className="btnAccent"
                onClick={() => runAction(retryJobAction)}
                disabled={pending}
                title={job.hasCheckpoint ? t.resumeTitle : t.retryTitle}
              >
                {pending ? t.retrying : job.hasCheckpoint ? t.resume : t.retry}
              </button>
            )}
          </div>
          {actionError && (
            <p className={styles.actionError} role="alert">
              {actionError}
            </p>
          )}
        </div>
      </div>

      <div className={styles.progressPanel}>
        <JobProgress status={job.status} progress={job.progress} variant="large" />
      </div>

      <dl className={styles.facts}>
        <Fact label={t.attempts} value={`${job.attempts} / ${job.maxAttempts}`} />
        <Fact label={t.duration} value={jobDuration(job, now)} />
        <TimeFact label={t.created} value={job.createdAt} now={now} />
        <TimeFact label={t.runAt} value={job.runAt} now={now} />
        <TimeFact label={t.started} value={job.startedAt} now={now} />
        <TimeFact label={t.finished} value={job.finishedAt} now={now} />
        <Fact
          label={t.checkpoint}
          value={job.hasCheckpoint ? t.checkpointSaved : t.checkpointNone}
          sub={job.hasCheckpoint && canRetry ? t.checkpointSavedSub : undefined}
        />
        {job.recurringJobId && (
          <Fact
            label={t.recurring}
            value={
              <Link href={`/dashboard/jobs?recurringJobId=${encodeURIComponent(job.recurringJobId)}`}>
                {job.recurringJobId}
              </Link>
            }
          />
        )}
      </dl>

      {job.error && (
        <div className={styles.block}>
          <h2 className={styles.blockTitle}>{t.error}</h2>
          <pre className={styles.errorPre}>{job.error}</pre>
        </div>
      )}

      <div className={styles.block}>
        <h2 className={styles.blockTitle}>{t.logs}</h2>
        <LogConsole lines={log.lines} hidden={log.hidden} max={MAX_LINES} fadeAfterId={fadeAfterId} />
        {liveError && <p className={styles.liveError}>{t.liveError.replace("{error}", liveError)}</p>}
      </div>

      <div className={styles.block}>
        <h2 className={styles.blockTitle}>{t.payload}</h2>
        <pre className={styles.pre}>{JSON.stringify(job.payload ?? {}, null, 2)}</pre>
      </div>
    </>
  );
}
