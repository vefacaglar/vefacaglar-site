"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LocaleProvider, useLocale } from "../../../../components/LocaleProvider";
import { localizeHref } from "../../../../lib/localizeHref";
import { formatDate } from "../../../../lib/formatDate";
import type { MovieActivity as Activity, MovieWatch } from "../../../../lib/movieActivity";
import { createMovieWatch, updateMovieWatch, deleteMovieWatch, setMovieRating, type MovieActionResult } from "../actions";
import { localToday } from "../watchDate";
import { freezeWatchSubmission, type WatchSubmission } from "../watchSubmission";
import ConfirmDialog from "../../../components/ConfirmDialog";
import DatePicker from "../../../components/DatePicker";
import styles from "./MovieActivity.module.css";

type WatchEditor = { id: string | null; watchedOn: string; comment: string; isPublic: boolean };

export default function MovieActivity({ slug, activity, isProfilePublic, communityPage }: { slug: string; activity: Activity; isProfilePublic: boolean; communityPage?: string }) {
  const router = useRouter(), locale = useLocale();
  const ratingId = useId(), dialogTitleId = useId(), dateId = useId(), commentId = useId();
  const [rating, setRating] = useState(activity.rating === null ? "" : String(activity.rating));
  const [editor, setEditor] = useState<WatchEditor | null>(null);
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
    setEditor(watch ? { id: watch.id, watchedOn: watch.watchedOn, comment: watch.comment ?? "", isPublic: watch.isPublic ?? false }
      : { id: null, watchedOn: addition.current?.watchedOn ?? localToday(), comment: addition.current?.comment ?? "", isPublic: addition.current?.isPublic ?? false });
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
      } catch { setError("Server connection error."); }
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
      } catch { setRating(previous); setRatingError("Server connection error."); }
      finally { busy.current = false; }
    });
  };
  const saveWatch = () => {
    if (!editor || busy.current) return;
    if (!editor.watchedOn) { setEditorError("Choose a watch date."); return; }
    const editingId = editor.id;
    const submission = editingId ? null : freezeWatchSubmission(addition.current, editor, () => crypto.randomUUID());
    if (submission) addition.current = submission;
    busy.current = true; setEditorError(null);
    startTransition(async () => {
      try {
        const result = editingId
          ? await updateMovieWatch(slug, editingId, editor.watchedOn, editor.comment.trim() || null, editor.isPublic)
          : await createMovieWatch(slug, submission!.id, submission!.watchedOn, submission!.comment, submission!.isPublic);
        if (result.error) {
          setEditorError(result.error);
          if (!editingId) {
            if (result.uncertain) setUnconfirmed(true);
            else if (!unconfirmed) addition.current = null;
          }
        } else {
          if (!editingId) { addition.current = null; setUnconfirmed(false); }
          returnFocus.current = true;
          setEditor(null);
          router.refresh();
        }
      } catch {
        setEditorError("We couldn't confirm the save. Please try again.");
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
      <div className={styles.sectionHeading}><h2>Your rating</h2><span className={styles.savedRating}>{rating ? `${rating} / 10` : "Not rated"}</span></div>
      <div className={styles.ratingForm}>
        <fieldset ref={ratingChoicesRef} className={styles.ratingChoices} disabled={pending}>
          <legend className={styles.srOnly}>Your rating from 1 to 10</legend>
          {Array.from({ length: 10 }, (_, index) => {
            const value = String(index + 1);
            return <label className={styles.ratingOption} key={value}>
              <input className={styles.ratingInput} type="radio" name={ratingId} value={value} checked={rating === value} onChange={() => { restoreRatingFocus.current = true; saveRating(value); }} aria-label={`${value} out of 10`} />
              <span className={styles.ratingBox}>{value}</span>
            </label>;
          })}
        </fieldset>
        <div className={styles.ratingFooter}>
          <p className={styles.muted} aria-live="polite">{pending ? "Saving…" : "One rating per film. Update it whenever you like."}</p>
          {rating && <button className={`btnGhost ${styles.clearRating}`} type="button" disabled={pending} onClick={() => saveRating("")}>Clear rating</button>}
        </div>
        {ratingError && <p className={styles.ratingError} role="alert">{ratingError}</p>}
      </div>
    </section>
    <section className={styles.section} id="watch-history">
      <div className={styles.sectionHeading}>
        <div><h2>Watch history</h2><p className={styles.muted}>{activity.total === 0 ? "Keep a record of each viewing." : `${activity.total} ${activity.total === 1 ? "watch" : "watches"} logged`}</p></div>
        <button className="btnAccent" type="button" disabled={pending} onClick={() => openEditor()}>Log watch</button>
      </div>
      {activity.total === 0 ? <p className={styles.empty}>No watches logged yet.</p> : <>
        <ul className={styles.watches}>{activity.watches.map((watch) => <li key={watch.id} className={styles.watch}>
          <div className={styles.watchDetails}><time dateTime={watch.watchedOn}>{formatDate(watch.watchedOn, "en")}</time>{watch.comment && <p className={styles.watchComment}>{watch.comment}</p>}</div>
          <div className={styles.controls}>
            <button className="btnGhost" disabled={pending} type="button" onClick={() => openEditor(watch)}>Edit watch</button>
            <button className="btnGhost" disabled={pending} type="button" onClick={() => setDeleting(watch.id)}>Delete</button>
          </div>
        </li>)}</ul>
        {activity.totalPages > 1 && <nav className={styles.controls} aria-label="Watch history pages">
          {activity.page > 1 && <Link className="btnGhost" href={pageHref(activity.page - 1)}>Previous</Link>}
          <span>Page {activity.page} of {activity.totalPages}</span>
          {activity.page < activity.totalPages && <Link className="btnGhost" href={pageHref(activity.page + 1)}>Next</Link>}
        </nav>}
      </>}
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={dialogTitleId}
      onCancel={(event) => { event.preventDefault(); closeEditor(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
      {editor && <form className={styles.dialogBody} onSubmit={(event) => { event.preventDefault(); saveWatch(); }}>
        <div className={styles.dialogHeading}><span className={styles.eyebrow}>Watch history</span><h2 id={dialogTitleId}>{editor.id ? "Edit watch" : "Log a watch"}</h2></div>
        <div className={styles.field}>
          <label htmlFor={dateId}>Watched on</label>
          <LocaleProvider locale="en"><DatePicker id={dateId} value={editor.watchedOn} disabled={pending || locked} onChange={(watchedOn) => setEditor({ ...editor, watchedOn })} /></LocaleProvider>
        </div>
        <div className={styles.field}>
          <label htmlFor={commentId}>Comment <span className={styles.optional}>Optional</span></label>
          <textarea id={commentId} className={styles.input} rows={4} maxLength={2000} value={editor.comment} disabled={pending || locked} aria-describedby={`${commentId}-hint`} placeholder="What stayed with you?" onChange={(event) => setEditor({ ...editor, comment: event.target.value })} />
          <div className={styles.commentHelp} id={`${commentId}-hint`}><span>{editor.isPublic ? "This comment is included when you share this watch." : "Only you can see this comment."}</span><span>{editor.comment.length}/2,000</span></div>
        </div>
        <label className={styles.shareChoice}>
          <input type="checkbox" checked={editor.isPublic} disabled={pending || locked || (!isProfilePublic && !editor.isPublic)} onChange={(event) => setEditor({ ...editor, isPublic: event.target.checked })} />
          <span>Share this watch publicly</span>
        </label>
        <p className={styles.shareHint}>{isProfilePublic ? "Your watch and comment will appear in the community section when shared." : <>Your profile is private. Make it public before sharing; existing shared watches remain hidden. <Link href={localizeHref("/profile/settings", locale)}>Profile settings</Link></>}</p>
        {locked && <p className={styles.retryNotice}>This save hasn't been confirmed. Retry the same details before changing them, so the watch is only added once.</p>}
        {editorError && <p className={styles.error} role="alert">{editorError}</p>}
        <div className={styles.dialogActions}>
          <button className="btnGhost" type="button" disabled={pending} onClick={closeEditor}>Cancel</button>
          <button className="btnAccent" type="submit" disabled={pending}>{pending ? "Saving…" : locked ? "Retry save" : "Save watch"}</button>
        </div>
      </form>}
    </dialog>
    <ConfirmDialog open={deleting !== null} message="Delete this watch entry? Your rating will stay saved." confirmLabel="Delete" cancelLabel="Cancel" pending={pending}
      onConfirm={() => { if (deleting) { const id = deleting; setDeleting(null); run(() => deleteMovieWatch(slug, id)); } }} onCancel={() => setDeleting(null)} />
  </div>;
}
