"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { getDictionary, type Dictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { createGameLog, deleteGameLog, type GameLogInput } from "../actions";
import ConfirmDialog from "../../components/ConfirmDialog";
import styles from "./game.module.css";

export type GameLog = {
  id: string;
  status: GameLogInput["status"];
  platform: { id: string; name: string } | null;
  rating: number | null;
  startedAt: string | null;
  completedAt: string | null;
  playtimeHours: number | null;
  notes: string | null;
  createdAt: string;
};

export const GAME_LOG_STATUSES: GameLogInput["status"][] = ["playing", "completed", "backlog", "on_hold", "abandoned"];

export function statusLabel(dict: Dictionary, status: GameLogInput["status"]): string {
  return dict[`status_${status}` as const];
}

/** "2010-10-19" -> "19 Oct 2010" / "19 Eki 2010", read as a local date so the day never shifts. */
function formatDate(value: string, locale: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** A fresh log starts as "playing"; the details are filled in on its own page. */
const QUICK_LOG: GameLogInput = {
  status: "playing",
  platformId: null,
  rating: null,
  startedAt: null,
  completedAt: null,
  playtimeHours: null,
  notes: null,
};

/** The signed-in user's logs for one game. Logging adds one instantly; each opens its own edit page. */
export default function GameLogs({ slug, logs }: { slug: string; logs: GameLog[] }) {
  const locale = useLocale();
  const dict = getDictionary(locale);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  };

  const onLog = () => run(() => createGameLog(slug, QUICK_LOG));

  const onDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete;
    setPendingDelete(null);
    run(() => deleteGameLog(slug, id));
  };

  return (
    <div className={styles.logs}>
      <button type="button" className="btnAccent" disabled={pending} onClick={onLog}>
        {dict.log_game}
      </button>

      {error && <p className="errorMsg">{error}</p>}

      {logs.length === 0 ? (
        <p className={styles.muted}>{dict.no_logs}</p>
      ) : (
        <ul className={styles.logList}>
          {logs.map((log) => (
            <li key={log.id} className={styles.logRow}>
              <Link href={localizeHref(`/games/${slug}/logs/${log.id}`, locale)} className={styles.logItem}>
                <div className={styles.logSummary}>
                  <span className={styles.status}>{statusLabel(dict, log.status)}</span>
                  {log.platform && <span>{log.platform.name}</span>}
                  {log.rating !== null && <span>{log.rating}/10</span>}
                  {log.playtimeHours !== null && <span>{`${log.playtimeHours}${dict.hours_short}`}</span>}
                  {log.startedAt && <span>{`${dict.log_started} ${formatDate(log.startedAt, locale)}`}</span>}
                  {log.completedAt && <span>{`${dict.log_completed} ${formatDate(log.completedAt, locale)}`}</span>}
                  <span className={styles.logEdit}>{dict.edit} →</span>
                </div>
                {log.notes && <p className={styles.notes}>{log.notes}</p>}
              </Link>
              <button
                type="button"
                className={`btnGhost ${styles.deleteButton}`}
                disabled={pending}
                onClick={() => setPendingDelete(log.id)}
                aria-label={dict.delete}
                title={dict.delete}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        message={dict.confirm_delete_log}
        confirmLabel={dict.delete}
        cancelLabel={dict.cancel}
        pending={pending}
        onConfirm={onDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V3h8v3" />
      <path d="M5 6l1 15h12l1-15" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
