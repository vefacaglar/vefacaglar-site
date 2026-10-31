"use client";

import { useState, useTransition } from "react";
import { useLocale } from "../../../components/LocaleProvider";
import { getDictionary, type Dictionary } from "../../../dictionaries";
import { createGameLog, deleteGameLog, updateGameLog, type GameLogInput } from "../actions";
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

type Platform = { id: string; name: string };

const STATUSES: GameLogInput["status"][] = ["playing", "completed", "backlog", "on_hold", "abandoned"];

function statusLabel(dict: Dictionary, status: GameLogInput["status"]): string {
  return dict[`status_${status}` as const];
}

/** The signed-in user's logs for one game, with add / edit / delete. */
export default function GameLogs({ slug, logs, platforms }: { slug: string; logs: GameLog[]; platforms: Platform[] }) {
  const dict = getDictionary(useLocale());
  // "new" for the add form, a log id while editing that log, null when no form is open.
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else setEditing(null);
    });
  };

  const onDelete = (id: string) => {
    if (window.confirm(dict.confirm_delete_log)) run(() => deleteGameLog(slug, id));
  };

  return (
    <div className={styles.logs}>
      {error && <p className="errorMsg">{error}</p>}

      {logs.length === 0 && editing !== "new" && <p className={styles.muted}>{dict.no_logs}</p>}

      <ul className={styles.logList}>
        {logs.map((log) =>
          editing === log.id ? (
            <li key={log.id}>
              <LogForm
                dict={dict}
                platforms={platforms}
                initial={log}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSubmit={(input) => run(() => updateGameLog(slug, log.id, input))}
              />
            </li>
          ) : (
            <li key={log.id} className={styles.logItem}>
              <div className={styles.logSummary}>
                <span className={styles.status}>{statusLabel(dict, log.status)}</span>
                {log.platform && <span>{log.platform.name}</span>}
                {log.rating !== null && <span>{log.rating}/10</span>}
                {log.playtimeHours !== null && <span>{`${log.playtimeHours}${dict.hours_short}`}</span>}
                {(log.startedAt || log.completedAt) && (
                  <span>{[log.startedAt, log.completedAt].map((d) => d ?? "…").join(" → ")}</span>
                )}
              </div>
              {log.notes && <p className={styles.notes}>{log.notes}</p>}
              <div className={styles.logActions}>
                <button type="button" className="btnGhost" disabled={pending} onClick={() => setEditing(log.id)}>
                  {dict.edit}
                </button>
                <button type="button" className="btnGhost" disabled={pending} onClick={() => onDelete(log.id)}>
                  {dict.delete}
                </button>
              </div>
            </li>
          )
        )}
      </ul>

      {editing === "new" ? (
        <LogForm
          dict={dict}
          platforms={platforms}
          pending={pending}
          onCancel={() => setEditing(null)}
          onSubmit={(input) => run(() => createGameLog(slug, input))}
        />
      ) : (
        <button type="button" className="btnAccent" disabled={pending} onClick={() => setEditing("new")}>
          {dict.log_game}
        </button>
      )}
    </div>
  );
}

function LogForm({
  dict,
  platforms,
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  dict: Dictionary;
  platforms: Platform[];
  initial?: GameLog;
  pending: boolean;
  onSubmit: (input: GameLogInput) => void;
  onCancel: () => void;
}) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value || null;
    };
    const number = (name: string) => {
      const value = text(name);
      return value === null ? null : Number(value);
    };
    onSubmit({
      status: form.get("status") as GameLogInput["status"],
      platformId: text("platformId"),
      rating: number("rating"),
      startedAt: text("startedAt"),
      completedAt: text("completedAt"),
      playtimeHours: number("playtimeHours"),
      notes: text("notes"),
    });
  };

  return (
    <form className={styles.logForm} onSubmit={handleSubmit}>
      <div className={styles.formGrid}>
        <label className="field">
          <span className="label">{dict.log_status}</span>
          <select name="status" className="input" defaultValue={initial?.status ?? "playing"}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(dict, s)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{dict.log_platform}</span>
          <select name="platformId" className="input" defaultValue={initial?.platform?.id ?? ""}>
            <option value="">—</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">{dict.log_rating}</span>
          <input name="rating" type="number" min={0} max={10} step={0.5} className="input" defaultValue={initial?.rating ?? ""} />
        </label>
        <label className="field">
          <span className="label">{dict.log_playtime}</span>
          <input name="playtimeHours" type="number" min={0} step={0.5} className="input" defaultValue={initial?.playtimeHours ?? ""} />
        </label>
        <label className="field">
          <span className="label">{dict.log_started}</span>
          <input name="startedAt" type="date" className="input" defaultValue={initial?.startedAt ?? ""} />
        </label>
        <label className="field">
          <span className="label">{dict.log_completed}</span>
          <input name="completedAt" type="date" className="input" defaultValue={initial?.completedAt ?? ""} />
        </label>
      </div>
      <label className="field">
        <span className="label">{dict.log_notes}</span>
        <textarea name="notes" rows={3} maxLength={2000} className="textarea" defaultValue={initial?.notes ?? ""} />
      </label>
      <div className={styles.logActions}>
        <button type="submit" className="btnAccent" disabled={pending}>
          {dict.save}
        </button>
        <button type="button" className="btnGhost" disabled={pending} onClick={onCancel}>
          {dict.cancel}
        </button>
      </div>
    </form>
  );
}
