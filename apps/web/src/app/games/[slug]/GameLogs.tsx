"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { getDictionary, type Dictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { createGameLog, type GameLogInput } from "../actions";
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
  const [pending, startTransition] = useTransition();

  const onLog = () => {
    setError(null);
    startTransition(async () => {
      const result = await createGameLog(slug, QUICK_LOG);
      if (result.error) setError(result.error);
    });
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
            <li key={log.id}>
              <Link href={localizeHref(`/games/${slug}/logs/${log.id}`, locale)} className={styles.logItem}>
                <div className={styles.logSummary}>
                  <span className={styles.status}>{statusLabel(dict, log.status)}</span>
                  {log.platform && <span>{log.platform.name}</span>}
                  {log.rating !== null && <span>{log.rating}/10</span>}
                  {log.playtimeHours !== null && <span>{`${log.playtimeHours}${dict.hours_short}`}</span>}
                  {(log.startedAt || log.completedAt) && (
                    <span>{[log.startedAt, log.completedAt].map((d) => d ?? "…").join(" → ")}</span>
                  )}
                  <span className={styles.logEdit}>{dict.edit} →</span>
                </div>
                {log.notes && <p className={styles.notes}>{log.notes}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
