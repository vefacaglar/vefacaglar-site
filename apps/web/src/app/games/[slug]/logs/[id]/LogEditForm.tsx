"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useLocale } from "../../../../../components/LocaleProvider";
import { getDictionary } from "../../../../../dictionaries";
import { localizeHref } from "../../../../../lib/localizeHref";
import { deleteGameLog, updateGameLog, type GameLogInput } from "../../../actions";
import { GAME_LOG_STATUSES, statusLabel } from "../../../gameLogStatus";
import type { GameLog } from "../../GameLogs";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import DatePicker from "../../../../components/DatePicker";
import { toDecimal, toDigits } from "../../../../../lib/numericInput";
import styles from "../../game.module.css";

export type LogGameInfo = {
  slug: string;
  title: string;
  coverImageUrl: string | null;
  releaseYear: string | null;
  developers: string | null;
  genres: string[];
  criticScore: number | null;
  hltbMainHours: number | null;
};

type StoredTimer = {
  baseSeconds: number;
  runningSince: number | null;
};

function timerStorageKey(logId: string): string {
  return `library_log_timer_${logId}`;
}

function readTimer(logId: string): StoredTimer {
  try {
    const raw = window.localStorage.getItem(timerStorageKey(logId));
    if (!raw) return { baseSeconds: 0, runningSince: null };
    const parsed = JSON.parse(raw) as Partial<StoredTimer>;
    return {
      baseSeconds: typeof parsed.baseSeconds === "number" && parsed.baseSeconds > 0 ? Math.floor(parsed.baseSeconds) : 0,
      runningSince: typeof parsed.runningSince === "number" ? parsed.runningSince : null,
    };
  } catch {
    return { baseSeconds: 0, runningSince: null };
  }
}

function writeTimer(logId: string, state: StoredTimer): void {
  try {
    if (state.baseSeconds <= 0 && state.runningSince === null) {
      window.localStorage.removeItem(timerStorageKey(logId));
    } else {
      window.localStorage.setItem(timerStorageKey(logId), JSON.stringify(state));
    }
  } catch {
    // Ignore storage errors.
  }
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function LogEditForm({
  slug,
  log,
  platforms,
  gameInfo,
}: {
  slug: string;
  log: GameLog;
  platforms: { id: string; name: string }[];
  gameInfo: LogGameInfo;
}) {
  const router = useRouter();
  const locale = useLocale();
  const dict = getDictionary(locale);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [playtimeValue, setPlaytimeValue] = useState<string>(() =>
    log.playtimeHours && log.playtimeHours > 0 ? String(log.playtimeHours) : "",
  );

  // Progress timer state
  const [timer, setTimer] = useState<StoredTimer>({ baseSeconds: 0, runningSince: null });
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Manual time state
  const [manualHours, setManualHours] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualSeconds, setManualSeconds] = useState("");

  useEffect(() => {
    const saved = readTimer(log.id);
    setTimer(saved);
    setNowMs(Date.now());
  }, [log.id]);

  useEffect(() => {
    if (timer.runningSince === null) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [timer.runningSince]);

  const elapsedSeconds =
    timer.baseSeconds +
    (timer.runningSince !== null ? Math.max(0, Math.floor((nowMs - timer.runningSince) / 1000)) : 0);

  const timerRunning = timer.runningSince !== null;

  const toggleTimer = () => {
    const currentNow = Date.now();
    setNowMs(currentNow);
    const next: StoredTimer =
      timer.runningSince !== null
        ? {
            baseSeconds: timer.baseSeconds + Math.max(0, Math.floor((currentNow - timer.runningSince) / 1000)),
            runningSince: null,
          }
        : {
            baseSeconds: timer.baseSeconds,
            runningSince: currentNow,
          };
    setTimer(next);
    writeTimer(log.id, next);
  };

  const resetTimer = () => {
    const next: StoredTimer = { baseSeconds: 0, runningSince: null };
    setTimer(next);
    writeTimer(log.id, next);
  };

  const addSecondsToPlaytime = (secondsToAdd: number) => {
    if (secondsToAdd <= 0) return;
    const current = Number(playtimeValue);
    const baseHours = Number.isFinite(current) && current > 0 ? current : 0;
    const nextHours = Math.min(100000, Math.round((baseHours + secondsToAdd / 3600) * 10) / 10);
    setPlaytimeValue(nextHours > 0 ? String(nextHours) : "");
  };

  const addTimerToPlaytime = () => {
    if (elapsedSeconds <= 0) return;
    addSecondsToPlaytime(elapsedSeconds);
    resetTimer();
  };

  const manualTotalSeconds =
    (Number(manualHours) || 0) * 3600 + (Number(manualMinutes) || 0) * 60 + (Number(manualSeconds) || 0);
  const hasManualTime = manualHours !== "" || manualMinutes !== "" || manualSeconds !== "";

  const resetManualTime = () => {
    setManualHours("");
    setManualMinutes("");
    setManualSeconds("");
  };

  const addManualToPlaytime = () => {
    if (manualTotalSeconds <= 0) return;
    addSecondsToPlaytime(manualTotalSeconds);
    resetManualTime();
  };

  const gameHref = localizeHref(`/games/${slug}`, locale);
  const dateLabels = {
    date_today: dict.date_today,
    date_clear: dict.date_clear,
    date_choose: dict.date_choose,
    date_previous_month: dict.date_previous_month,
    date_next_month: dict.date_next_month,
    date_previous_year: dict.date_previous_year,
    date_next_year: dict.date_next_year,
  };

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
      if (value === null) return null;
      const num = Number(value);
      return Number.isFinite(num) && num > 0 ? num : null;
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

  const subline = [gameInfo.developers, gameInfo.releaseYear].filter(Boolean).join(" · ");

  return (
    <>
      <div className={styles.logLayout}>
        <aside className={styles.logSidebar}>
          <div className={styles.logGameCard}>
            <Link href={gameHref} className={styles.logGameCover}>
              {gameInfo.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={gameInfo.coverImageUrl} alt={gameInfo.title} />
              ) : (
                <span className={styles.logGameFallback}>{gameInfo.title}</span>
              )}
            </Link>
            <div className={styles.logGameBody}>
              <Link href={gameHref} className={styles.logGameTitle}>
                {gameInfo.title}
              </Link>
              {subline && <p className={styles.logGameMeta}>{subline}</p>}
              {gameInfo.genres.length > 0 && (
                <p className={styles.logGameGenres}>{gameInfo.genres.join(", ")}</p>
              )}
              {(gameInfo.criticScore !== null || gameInfo.hltbMainHours !== null) && (
                <div className={styles.logGameBadges}>
                  {gameInfo.criticScore !== null && (
                    <span className={styles.logGameBadge}>
                      {dict.critic_score} {gameInfo.criticScore}/100
                    </span>
                  )}
                  {gameInfo.hltbMainHours !== null && (
                    <span className={styles.logGameBadge}>
                      {dict.hltb_main} {gameInfo.hltbMainHours}{dict.hours_short}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <section className={styles.timerCard} aria-label={dict.progress_timer}>
            <h2 className={styles.timerTitle}>{dict.progress_timer}</h2>
            <div className={styles.timerDisplay} aria-live="polite">
              {formatClock(elapsedSeconds)}
            </div>
            <div className={styles.timerActions}>
              <div className={styles.timerActionsLeft}>
                <button type="button" className="btnAccent" onClick={toggleTimer}>
                  {timerRunning ? dict.timer_pause : dict.timer_start}
                </button>
                <button
                  type="button"
                  className={`btnGhost ${styles.timerAddBtn}`}
                  disabled={elapsedSeconds <= 0}
                  onClick={addTimerToPlaytime}
                >
                  {dict.timer_add}
                </button>
              </div>
              <button
                type="button"
                className="btnGhost"
                disabled={elapsedSeconds <= 0 && !timerRunning}
                onClick={resetTimer}
              >
                {dict.timer_reset}
              </button>
            </div>
          </section>

          <section className={styles.timerCard} aria-label={dict.add_manual_time}>
            <h2 className={styles.timerTitle}>{dict.add_manual_time}</h2>
            <div className={styles.manualTimeGrid}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="HHH"
                maxLength={4}
                aria-label="Hours"
                className={`input ${styles.manualInput}`}
                value={manualHours}
                onChange={(e) => setManualHours(toDigits(e.currentTarget.value))}
              />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM"
                maxLength={2}
                aria-label="Minutes"
                className={`input ${styles.manualInput}`}
                value={manualMinutes}
                onChange={(e) => setManualMinutes(toDigits(e.currentTarget.value))}
              />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="SS"
                maxLength={2}
                aria-label="Seconds"
                className={`input ${styles.manualInput}`}
                value={manualSeconds}
                onChange={(e) => setManualSeconds(toDigits(e.currentTarget.value))}
              />
            </div>
            <div className={styles.timerActions}>
              <button
                type="button"
                className={`btnGhost ${styles.timerAddBtn}`}
                disabled={manualTotalSeconds <= 0}
                onClick={addManualToPlaytime}
              >
                {dict.timer_add}
              </button>
              <button
                type="button"
                className="btnGhost"
                disabled={!hasManualTime}
                onClick={resetManualTime}
              >
                {dict.timer_reset}
              </button>
            </div>
          </section>
        </aside>

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
              <div className={styles.suffixField}>
                <input
                  name="rating"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={3}
                  className="input"
                  defaultValue={log.rating && log.rating > 0 ? log.rating : ""}
                  onChange={(e) => {
                    const digits = toDigits(e.currentTarget.value);
                    e.currentTarget.value = digits === "" ? "" : String(Math.min(100, Number(digits)));
                  }}
                />
                <span className={styles.suffix} aria-hidden="true">
                  /100
                </span>
              </div>
            </label>
            <label className="field">
              <span className="label">{dict.log_playtime}</span>
              <input
                name="playtimeHours"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="input"
                value={playtimeValue}
                onChange={(e) => {
                  setPlaytimeValue(toDecimal(e.currentTarget.value));
                }}
              />
            </label>
            <div className="field">
              <label className="label" htmlFor="startedAt">
                {dict.log_started}
              </label>
              <DatePicker id="startedAt" name="startedAt" defaultValue={log.startedAt} labels={dateLabels} />
            </div>
            <div className="field">
              <label className="label" htmlFor="completedAt">
                {dict.log_completed}
              </label>
              <DatePicker id="completedAt" name="completedAt" defaultValue={log.completedAt} labels={dateLabels} />
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
      </div>

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
