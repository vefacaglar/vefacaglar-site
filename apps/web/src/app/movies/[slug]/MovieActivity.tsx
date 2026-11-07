"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "../../../components/LocaleProvider";
import { localizeHref } from "../../../lib/localizeHref";
import { formatDate } from "../../../lib/formatDate";
import type { MovieActivity as Activity } from "../../../lib/movieActivity";
import { createMovieWatch, updateMovieWatch, deleteMovieWatch, setMovieRating } from "../actions";
import { localToday } from "../watchDate";
import ConfirmDialog from "../../components/ConfirmDialog";
import styles from "./MovieActivity.module.css";
export default function MovieActivity({ slug, activity }: { slug: string; activity: Activity }) {
  const router = useRouter(), locale = useLocale();
  const [rating, setRating] = useState(activity.rating === null ? "" : String(activity.rating));
  const [watchedOn, setWatchedOn] = useState("");
  const [editing, setEditing] = useState<{ id: string; watchedOn: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const addition = useRef<{ id: string; watchedOn: string } | null>(null);
  useEffect(() => { setWatchedOn(localToday()); }, []);
  useEffect(() => { setRating(activity.rating === null ? "" : String(activity.rating)); }, [activity.rating]);
  const run = (action: () => Promise<{ error?: string }>, success?: () => void) => {
    if (busy.current) return;
    busy.current = true; setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) setError(result.error);
        else { success?.(); router.refresh(); }
      } catch { setError("Server connection error."); }
      finally { busy.current = false; }
    });
  };
  const addWatch = () => {
    if (!watchedOn) { setError("Choose a watch date."); return; }
    if (!addition.current || addition.current.watchedOn !== watchedOn) addition.current = { id: crypto.randomUUID(), watchedOn };
    const request = addition.current;
    run(() => createMovieWatch(slug, request.id, request.watchedOn), () => { addition.current = null; });
  };
  const pageHref = (page: number) => localizeHref(`/movies/${slug}${page > 1 ? `?watchPage=${page}` : ""}#watch-history`, locale);
  return <div className={styles.activity}>
    <section className={styles.section}>
      <h2>Your rating</h2>
      <form className={styles.controls} onSubmit={(event) => { event.preventDefault(); run(() => setMovieRating(slug, rating ? Number(rating) : null)); }}>
        <label htmlFor="movie-rating">Rating</label>
        <select id="movie-rating" className={styles.input} value={rating} disabled={pending} onChange={(event) => setRating(event.target.value)}>
          <option value="">Not rated</option>
          {Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}/10</option>)}
        </select>
        <button className="btnAccent" type="submit" disabled={pending}>Save rating</button>
        {activity.rating !== null && <button className="btnGhost" type="button" disabled={pending} onClick={() => run(() => setMovieRating(slug, null))}>Clear rating</button>}
      </form>
    </section>
    <section className={styles.section} id="watch-history">
      <h2>Watch history</h2>
      <form className={styles.controls} onSubmit={(event) => { event.preventDefault(); addWatch(); }}>
        <label htmlFor="movie-watch-date">Watched on</label>
        <input id="movie-watch-date" type="date" required className={styles.input} value={watchedOn} disabled={pending} onChange={(event) => setWatchedOn(event.target.value)} />
        <button className="btnAccent" type="submit" disabled={pending || !watchedOn}>Log watch</button>
      </form>
      {activity.total === 0 ? <p className={styles.muted}>No watches logged yet.</p> : <>
        <p className={styles.muted}>{activity.total} {activity.total === 1 ? "watch" : "watches"}</p>
        <ul className={styles.watches}>{activity.watches.map((watch) => <li key={watch.id} className={styles.watch}>
          {editing?.id === watch.id ? <form className={styles.controls} onSubmit={(event) => { event.preventDefault(); run(() => updateMovieWatch(slug, watch.id, editing.watchedOn), () => setEditing(null)); }}>
            <label className={styles.srOnly} htmlFor={`watch-${watch.id}`}>Watch date</label>
            <input id={`watch-${watch.id}`} className={styles.input} type="date" required value={editing.watchedOn} disabled={pending} onChange={(event) => setEditing({ id: watch.id, watchedOn: event.target.value })} />
            <button className="btnAccent" disabled={pending} type="submit">Save date</button>
            <button className="btnGhost" disabled={pending} type="button" onClick={() => setEditing(null)}>Cancel</button>
          </form> : <><time dateTime={watch.watchedOn}>{formatDate(watch.watchedOn, "en")}</time><div className={styles.controls}>
            <button className="btnGhost" disabled={pending} type="button" onClick={() => setEditing({ id: watch.id, watchedOn: watch.watchedOn })}>Edit date</button>
            <button className="btnGhost" disabled={pending} type="button" onClick={() => setDeleting(watch.id)}>Delete</button>
          </div></>}
        </li>)}</ul>
        {activity.totalPages > 1 && <nav className={styles.controls} aria-label="Watch history pages">
          {activity.page > 1 && <Link className="btnGhost" href={pageHref(activity.page - 1)}>Previous</Link>}
          <span>Page {activity.page} of {activity.totalPages}</span>
          {activity.page < activity.totalPages && <Link className="btnGhost" href={pageHref(activity.page + 1)}>Next</Link>}
        </nav>}
      </>}
    </section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <ConfirmDialog open={deleting !== null} message="Delete this watch entry? Your rating will stay saved." confirmLabel="Delete" cancelLabel="Cancel" pending={pending}
      onConfirm={() => { if (deleting) { const id = deleting; setDeleting(null); run(() => deleteMovieWatch(slug, id)); } }} onCancel={() => setDeleting(null)} />
  </div>;
}
