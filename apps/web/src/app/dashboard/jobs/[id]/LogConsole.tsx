"use client";

import React, { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "../jobs.module.css";
import ds from "../../../../lib/dashboard-strings";
import { absoluteTime, clockTime, formatCount } from "../format";
import type { JobLog } from "../types";

const t = ds.jobs.detail;

const LEVEL_CLASS: Record<JobLog["level"], string> = {
  info: styles.lvlInfo,
  warn: styles.lvlWarn,
  error: styles.lvlError,
};

/** Distance from the bottom (px) that still counts as "following the tail". */
const FOLLOW_THRESHOLD = 24;

const LogLine = memo(function LogLine({ line, fresh }: { line: JobLog; fresh: boolean }) {
  return (
    <div
      className={`${styles.logLine} ${LEVEL_CLASS[line.level] ?? styles.lvlInfo} ${fresh ? styles.logLineNew : ""}`}
    >
      <span className={styles.logTime} title={absoluteTime(line.createdAt)}>
        {clockTime(line.createdAt)}
      </span>
      <span className={styles.logLevel}>{line.level}</span>
      <span className={styles.logMsg}>{line.message}</span>
    </div>
  );
});

type Props = {
  lines: JobLog[];
  /** Lines dropped from the top to keep the DOM bounded. */
  hidden: number;
  max: number;
  /** Lines with a higher id arrived live and fade in; older ones were server-rendered. */
  fadeAfterId: number;
};

/**
 * Flowing log tail: newest at the bottom, follows the tail while the reader is
 * at the bottom, pauses (with a "jump to latest (N new)" button) once they
 * scroll up.
 */
function LogConsole({ lines, hidden, max, fadeAfterId }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const [pausedAtId, setPausedAtId] = useState<number | null>(null);
  const following = pausedAtId === null;

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD;
    if (atBottom === followRef.current) return;
    followRef.current = atBottom;
    setPausedAtId(atBottom ? null : (lines.at(-1)?.id ?? -1));
  };

  const jumpToLatest = () => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
    followRef.current = true;
    setPausedAtId(null);
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && followRef.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const unseen = useMemo(() => {
    if (pausedAtId === null) return 0;
    let n = 0;
    for (let i = lines.length - 1; i >= 0 && lines[i].id > pausedAtId; i--) n++;
    return n;
  }, [lines, pausedAtId]);

  return (
    <div className={styles.logWrap}>
      <div ref={ref} className={styles.log} onScroll={onScroll} role="log" aria-label={t.logs}>
        {hidden > 0 && (
          <div className={styles.logCapped}>
            {t.logCapped.replace("{max}", formatCount(max)).replace("{hidden}", formatCount(hidden))}
          </div>
        )}
        {lines.length === 0 ? (
          <div className={styles.logEmpty}>{t.noLogs}</div>
        ) : (
          lines.map((line) => <LogLine key={line.id} line={line} fresh={line.id > fadeAfterId} />)
        )}
      </div>
      {!following && lines.length > 0 && (
        <button type="button" className={`btnGhost ${styles.compact} ${styles.jump}`} onClick={jumpToLatest}>
          {unseen > 0 ? t.jumpToLatestNew.replace("{count}", formatCount(unseen)) : t.jumpToLatest}
        </button>
      )}
    </div>
  );
}

export default memo(LogConsole);
