"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLocale } from "../../../../../components/LocaleProvider";
import { getDictionary } from "../../../../../dictionaries";
import { localizeHref } from "../../../../../lib/localizeHref";
import { deleteGameLog, updateGameLog, type GameLogInput } from "../../../actions";
import { GAME_LOG_STATUSES, statusLabel } from "../../../gameLogStatus";
import type { GameLog } from "../../GameLogs";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import DatePicker from "../../../../components/DatePicker";
import styles from "../../game.module.css";

export default function LogEditForm({
  slug,
  log,
  platforms,
}: {
  slug: string;
  log: GameLog;
  platforms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const locale = useLocale();
  const dict = getDictionary(locale);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const gameHref = localizeHref(`/games/${slug}`, locale);

  const run = (action: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
      else router.push(gameHref);
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const number = (name: string) => {
      const value = text(name);
      return value === null ? null : Number(value);
    };
    const input: GameLogInput = {
      status: form.get("status") as GameLogInput["status"],
      platformId: text("platformId"),
      rating: number("rating"),
      startedAt: text("startedAt"),
      completedAt: text("completedAt"),
      playtimeHours: number("playtimeHours"),
      notes: text("notes"),
    };
    run(() => updateGameLog(slug, log.id, input));
  };

  const onDelete = () => {
    setConfirmOpen(false);
    run(() => deleteGameLog(slug, log.id));
  };

  return (
    <>
      <form className={styles.logForm} onSubmit={handleSubmit}>
        {error && <p className="errorMsg">{error}</p>}
        <div className={styles.formGrid}>
          <label className="field">
            <span className="label">{dict.log_status}</span>
            <select name="status" className="input" defaultValue={log.status}>
              {GAME_LOG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(dict, s)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">{dict.log_platform}</span>
            <select name="platformId" className="input" defaultValue={log.platform?.id ?? ""}>
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
            <input name="rating" type="number" min={0} max={10} step={0.5} className="input" defaultValue={log.rating ?? ""} />
          </label>
          <label className="field">
            <span className="label">{dict.log_playtime}</span>
            <input name="playtimeHours" type="number" min={0} step={0.5} className="input" defaultValue={log.playtimeHours ?? ""} />
          </label>
          <div className="field">
            <label className="label" htmlFor="startedAt">
              {dict.log_started}
            </label>
            <DatePicker id="startedAt" name="startedAt" defaultValue={log.startedAt} />
          </div>
          <div className="field">
            <label className="label" htmlFor="completedAt">
              {dict.log_completed}
            </label>
            <DatePicker id="completedAt" name="completedAt" defaultValue={log.completedAt} />
          </div>
        </div>
        <label className="field">
          <span className="label">{dict.log_notes}</span>
          <textarea name="notes" rows={4} maxLength={2000} className="textarea" defaultValue={log.notes ?? ""} />
        </label>
        <div className={styles.formFooter}>
          <div className={styles.logActions}>
            <button type="submit" className="btnAccent" disabled={pending}>
              {dict.save}
            </button>
            <button type="button" className="btnGhost" disabled={pending} onClick={() => router.push(gameHref)}>
              {dict.cancel}
            </button>
          </div>
          <button type="button" className="btnGhost" disabled={pending} onClick={() => setConfirmOpen(true)}>
            {dict.delete}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        message={dict.confirm_delete_log}
        confirmLabel={dict.delete}
        cancelLabel={dict.cancel}
        pending={pending}
        onConfirm={onDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
