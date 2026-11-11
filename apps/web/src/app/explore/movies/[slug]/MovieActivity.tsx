"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "../../../../components/LocaleProvider";
import { localizeHref } from "../../../../lib/localizeHref";
import { formatDate } from "../../../../lib/formatDate";
import type { MovieActivity as Activity, MovieWatch } from "../../../../lib/movieActivity";
import { createMovieWatch, updateMovieWatch, deleteMovieWatch, setMovieRating, type MovieActionResult } from "../actions";
import { freezeWatchSubmission, type WatchSubmission } from "../watchSubmission";
import ConfirmDialog from "../../../components/ConfirmDialog";
import DatePicker from "../../../components/DatePicker";
import { istanbulToday, isAllowedLogDate } from "../../../../lib/logDates";
import { readMovieLogPreferences, writeMovieLogPreferences } from "../../../../lib/logPreferences";
import { useLogCalendarToday } from "../../../../lib/useLogCalendarToday";
import styles from "./MovieActivity.module.css";
import { movieActivityLabels } from "./movieActivityLabels";

type WatchEditor = { id: string | null; watchedOn: string; comment: string; isPublic: boolean };

export default function MovieActivity({ slug, activity, userId, isProfilePublic, communityPage }: { slug: string; activity: Activity; userId: string | null; isProfilePublic: boolean; communityPage?: string }) {
  const router = useRouter(), locale = useLocale();
  const labels = movieActivityLabels[locale];
  const ratingId = useId(), dialogTitleId = useId(), dateId = useId(), commentId = useId();
  const [rating, setRating] = useState(activity.rating === null ? "" : String(activity.rating));
  const [editor, setEditor] = useState<WatchEditor | null>(null);
  const [logToday, refreshLogToday] = useLogCalendarToday(editor !== null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const ratingChoicesRef = useRef<HTMLFieldSetElement>(null);
  const restoreRatingFocus = useRef(false);
  const addition = useRef<WatchSubmission | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const returnFocus = useRef(false);

  useEffect(() => { setRating(activity.rating === null ? "" : String(activity.rating)); }, [activity.rating]);
  useEffect(() => {
    if (pending || !restoreRatingFocus.current) return;
    restoreRatingFocus.current = false;
    if (document.activeElement === document.body) {
      (ratingChoicesRef.current?.querySelector<HTMLInputElement>("input:checked") ??
        ratingChoicesRef.current?.querySelector<HTMLInputElement>("input"))?.focus();
    }
  }, [pending, rating]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (editor && !dialog.open) {
      dialog.showModal();
    } else if (!editor) {
      if (dialog.open) dialog.close();
      if (!pending && returnFocus.current) {
        openerRef.current?.focus();
        returnFocus.current = false;
      }
    }
  }, [editor, pending]);

  const openEditor = (watch?: MovieWatch) => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditorError(null);
    const defaults = readMovieLogPreferences(userId, isProfilePublic);
    const retry = addition.current;
    setEditor(watch ? { id: watch.id, watchedOn: watch.watchedOn ?? "", comment: watch.comment ?? "", isPublic: watch.isPublic ?? false }
      : retry ? { id: null, watchedOn: retry.watchedOn ?? "", comment: retry.comment ?? "", isPublic: retry.isPublic }
      : { id: null, watchedOn: defaults.watchedOn ?? "", comment: "", isPublic: defaults.isPublic });
  };
  const closeEditor = () => {
    if (busy.current) return;
    returnFocus.current = true;
    setEditor(null);
  };
  const run = (action: () => Promise<MovieActionResult>) => {
    if (busy.current) return;
    busy.current = true; setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else router.refresh();
      } catch { setError(labels.serverError); }
      finally { busy.current = false; }
    });
  };
  const saveRating = (next: string) => {
    if (busy.current || pending || next === rating) return;
    const previous = rating;
    busy.current = true;
    setRatingError(null);
    setRating(next);
    startTransition(async () => {
      try {
        const result = await setMovieRating(slug, next ? Number(next) : null);
        if (result.error) { setRating(previous); setRatingError(result.error); }
        else router.refresh();
      } catch { setRating(previous); setRatingError(labels.serverError); }
      finally { busy.current = false; }
    });
  };
  const saveWatch = () => {
    if (!editor || busy.current) return;
    const previous = editor.id ? activity.watches.find((watch) => watch.id === editor.id)?.watchedOn ?? null : null;
    if (!isAllowedLogDate(editor.watchedOn || null, previous, istanbulToday())) {
      setEditorError(labels.futureDate);
      return;
    }
    const editingId = editor.id;
    const submission = editingId ? null : freezeWatchSubmission(addition.current, editor, () => crypto.randomUUID());
    if (submission) addition.current = submission;
    busy.current = true; setEditorError(null);
    startTransition(async () => {
      try {
        const result = editingId
          ? await updateMovieWatch(slug, editingId, editor.watchedOn || null, editor.comment.trim() || null, editor.isPublic)
          : await createMovieWatch(slug, submission!.id, submission!.watchedOn, submission!.comment, submission!.isPublic);
        if (result.error) {
          setEditorError(result.error);
          if (!editingId) {
            if (result.uncertain) setUnconfirmed(true);
            else if (!unconfirmed) addition.current = null;
          }
        } else {
          writeMovieLogPreferences(userId, { watchedOn: editingId ? editor.watchedOn || null : submission!.watchedOn, isPublic: editingId ? editor.isPublic : submission!.isPublic });
          if (!editingId) { addition.current = null; setUnconfirmed(false); }
          returnFocus.current = true;
          setEditor(null);
          router.refresh();
        }
      } catch {
        setEditorError(labels.saveUnconfirmed);
        if (!editingId) setUnconfirmed(true);
      } finally { busy.current = false; }
    });
  };
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (page > 1) query.set("watchPage", String(page));
    if (communityPage) query.set("communityPage", communityPage);
    return localizeHref(`/explore/movies/${slug}${query.size ? `?${query}` : ""}#watch-history`, locale);
  };
  const locked = editor?.id === null && unconfirmed;

  return <div className={styles.activity}>
    <section className={styles.section}>
      <div className={styles.sectionHeading}><h2>{labels.rating}</h2><span className={styles.savedRating}>{rating ? `${rating} / 10` : labels.notRated}</span></div>
      <div className={styles.ratingForm}>
        <fieldset ref={ratingChoicesRef} className={styles.ratingChoices} disabled={pending}>
          <legend className={styles.srOnly}>{labels.ratingLegend}</legend>
          {Array.from({ length: 10 }, (_, index) => {
            const value = String(index + 1);
            return <label className={styles.ratingOption} key={value}>
              <input className={styles.ratingInput} type="radio" name={ratingId} value={value} checked={rating === value} onChange={() => { restoreRatingFocus.current = true; saveRating(value); }} aria-label={labels.outOfTen.replace("{value}", value)} />
              <span className={styles.ratingBox}>{value}</span>
            </label>;
          })}
        </fieldset>
        <div className={styles.ratingFooter}>
          <p className={styles.muted} aria-live="polite">{pending ? labels.saving : labels.ratingHint}</p>
          {rating && <button className={`btnGhost ${styles.clearRating}`} type="button" disabled={pending} onClick={() => saveRating("")}>{labels.clearRating}</button>}
        </div>
        {ratingError && <p className={styles.ratingError} role="alert">{ratingError}</p>}
      </div>
    </section>
    <section className={styles.section} id="watch-history">
      <div className={styles.sectionHeading}>
        <div><h2>{labels.history}</h2><p className={styles.muted}>{activity.total === 0 ? labels.historyHint : activity.total === 1 ? labels.watchOne : labels.watchCount.replace("{count}", String(activity.total))}</p></div>
        <button className="btnAccent" type="button" disabled={pending} onClick={() => openEditor()}>{labels.logWatch}</button>
      </div>
      {activity.total === 0 ? <p className={styles.empty}>{labels.noWatches}</p> : <>
        <ul className={styles.watches}>{activity.watches.map((watch) => <li key={watch.id} className={styles.watch}>
          <div className={styles.watchDetails}>{watch.watchedOn ? <time dateTime={watch.watchedOn}>{formatDate(watch.watchedOn, locale)}</time> : <span>{labels.noDate}</span>}{watch.comment && <p className={styles.watchComment}>{watch.comment}</p>}</div>
          <div className={styles.controls}>
            <button className="btnGhost" disabled={pending} type="button" onClick={() => openEditor(watch)}>{labels.edit}</button>
            <button className="btnGhost" disabled={pending} type="button" onClick={() => setDeleting(watch.id)}>{labels.delete}</button>
          </div>
        </li>)}</ul>
        {activity.totalPages > 1 && <nav className={styles.controls} aria-label={labels.pages}>
          {activity.page > 1 && <Link className="btnGhost" href={pageHref(activity.page - 1)}>{labels.previous}</Link>}
          <span>{labels.pageOf.replace("{current}", String(activity.page)).replace("{total}", String(activity.totalPages))}</span>
          {activity.page < activity.totalPages && <Link className="btnGhost" href={pageHref(activity.page + 1)}>{labels.next}</Link>}
        </nav>}
      </>}
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={dialogTitleId}
      onCancel={(event) => { event.preventDefault(); closeEditor(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
      {editor && <form className={styles.dialogBody} onSubmit={(event) => { event.preventDefault(); saveWatch(); }}>
        <div className={styles.dialogHeading}><span className={styles.eyebrow}>{labels.history}</span><h2 id={dialogTitleId}>{editor.id ? labels.edit : labels.logAWatch}</h2></div>
        <div className={styles.field} onFocusCapture={refreshLogToday}>
          <label htmlFor={dateId}>{labels.watchedOn} <span className={styles.optional}>{labels.optional}</span></label>
          <DatePicker id={dateId} value={editor.watchedOn} max={logToday} today={logToday} disabled={pending || locked} onChange={(watchedOn) => setEditor({ ...editor, watchedOn })} />
        </div>
        <div className={styles.field}>
          <label htmlFor={commentId}>{labels.comment} <span className={styles.optional}>{labels.optional}</span></label>
          <textarea id={commentId} className={styles.input} rows={4} maxLength={2000} value={editor.comment} disabled={pending || locked} aria-describedby={`${commentId}-hint`} placeholder={labels.commentPlaceholder} onChange={(event) => setEditor({ ...editor, comment: event.target.value })} />
          <div className={styles.commentHelp} id={`${commentId}-hint`}><span>{editor.isPublic ? labels.commentPublic : labels.commentPrivate}</span><span>{editor.comment.length}/2,000</span></div>
        </div>
        <label className={styles.shareChoice}>
          <input type="checkbox" checked={editor.isPublic} disabled={pending || locked || (!isProfilePublic && !editor.isPublic)} onChange={(event) => setEditor({ ...editor, isPublic: event.target.checked })} />
          <span>{labels.share}</span>
        </label>
        <p className={styles.shareHint}>{isProfilePublic ? labels.shareHint : <>{labels.privateHint} <Link href={localizeHref("/profile/settings", locale)}>{labels.profileSettings}</Link></>}</p>
        {locked && <p className={styles.retryNotice}>{labels.retryHint}</p>}
        {editorError && <p className={styles.error} role="alert">{editorError}</p>}
        <div className={styles.dialogActions}>
          <button className="btnGhost" type="button" disabled={pending} onClick={closeEditor}>{labels.cancel}</button>
          <button className="btnAccent" type="submit" disabled={pending}>{pending ? labels.saving : locked ? labels.retry : labels.save}</button>
        </div>
      </form>}
    </dialog>
    <ConfirmDialog open={deleting !== null} message={labels.deleteConfirm} confirmLabel={labels.delete} cancelLabel={labels.cancel} pending={pending}
      onConfirm={() => { if (deleting) { const id = deleting; setDeleting(null); run(() => deleteMovieWatch(slug, id)); } }} onCancel={() => setDeleting(null)} />
  </div>;
}
