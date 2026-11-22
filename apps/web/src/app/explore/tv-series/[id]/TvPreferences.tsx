"use client";
import { useId, useRef, useState } from "react";
import type { TvPreferences as Preferences } from "../../../../lib/tvPreferences";
import { setTvPersonalNote, setTvPersonalRating } from "../preferences.actions";
import styles from "./TvPreferences.module.css";

export default function TvPreferences({ seriesId, initial }: { seriesId: number; initial: Preferences }) {
  const ratingId = useId();
  const noteId = useId();
  const [savedRating, setSavedRating] = useState({ value: initial.rating, version: initial.ratingVersion });
  const [savedNote, setSavedNote] = useState({ value: initial.note, version: initial.noteVersion });
  const [rating, setRating] = useState<number | null>(initial.rating);
  const [note, setNote] = useState(initial.note ?? "");
  const [ratingPending, setRatingPending] = useState(false);
  const [notePending, setNotePending] = useState(false);
  const [ratingMessage, setRatingMessage] = useState<string | null>(null);
  const [noteMessage, setNoteMessage] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteConflict, setNoteConflict] = useState(false);
  const ratingBusy = useRef(false);
  const noteBusy = useRef(false);

  async function saveRating(value: number | null) {
    if (ratingBusy.current) return;
    ratingBusy.current = true;
    setRatingPending(true);
    setRatingError(null);
    setRatingMessage(null);
    try {
      const result = await setTvPersonalRating(seriesId, value, savedRating.version);
      if (result.preferences) {
        setSavedRating({ value: result.preferences.rating, version: result.preferences.ratingVersion });
      }
      if (result.error) setRatingError(result.error);
      else if (result.preferences) {
        setRating(result.preferences.rating);
        setRatingMessage(value === null ? "Rating cleared." : "Rating saved.");
      }
    } catch { setRatingError("Your rating could not be confirmed. Try saving again."); }
    finally { ratingBusy.current = false; setRatingPending(false); }
  }
  async function saveNote(value: string | null) {
    if (noteBusy.current) return;
    noteBusy.current = true;
    setNotePending(true);
    setNoteError(null);
    setNoteMessage(null);
    try {
      const result = await setTvPersonalNote(seriesId, value, savedNote.version);
      if (result.preferences) {
        setSavedNote({ value: result.preferences.note, version: result.preferences.noteVersion });
      }
      setNoteConflict(!!result.conflict);
      if (result.error) setNoteError(result.error);
      else if (result.preferences) {
        setNote(result.preferences.note ?? "");
        setNoteMessage(result.preferences.note === null ? "Note cleared." : "Note saved.");
      }
    } catch { setNoteError("Your note could not be confirmed. Your draft is preserved. Try saving again."); }
    finally { noteBusy.current = false; setNotePending(false); }
  }

  return <section className={styles.preferences} aria-labelledby={`${ratingId}-title`}>
    <h2 id={`${ratingId}-title`}>Your rating and note</h2>
    <form className={styles.ratingForm} onSubmit={(event) => { event.preventDefault(); void saveRating(rating); }}>
      <div className={styles.heading}>
        <span id={`${ratingId}-label`}>Your rating</span>
        <span className={styles.saved}>{savedRating.value === null ? "Not rated" : `Saved ${savedRating.value} / 10`}</span>
      </div>
      <fieldset className={styles.ratingChoices} disabled={ratingPending}>
        <legend className={styles.srOnly}>Your rating out of 10</legend>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <label className={styles.ratingOption} key={value}>
          <input className={styles.ratingInput} type="radio" name={ratingId} value={value} checked={rating === value}
            onChange={() => { setRating(value); setRatingMessage(null); }} aria-label={`${value} out of 10`} />
          <span className={styles.ratingBox}>{value}</span>
        </label>)}
      </fieldset>
      <div className={styles.actions}>
        <button type="submit" className="btnAccent" disabled={ratingPending || rating === savedRating.value}>{ratingPending ? "Saving…" : "Save rating"}</button>
        {savedRating.value !== null && <button type="button" className="btnGhost" disabled={ratingPending} onClick={() => { setRating(null); void saveRating(null); }}>Clear rating</button>}
      </div>
      {ratingError && <p className={styles.error} role="alert">{ratingError}</p>}
      <p className={styles.status} role="status">{ratingMessage || (ratingPending ? "Saving rating…" : "")}</p>
    </form>
    <form className={styles.noteForm} onSubmit={(event) => { event.preventDefault(); void saveNote(note); }}>
      <div className={styles.heading}><label htmlFor={noteId}>Personal note</label><span className={styles.saved}>Only you can see this</span></div>
      <textarea id={noteId} value={note} onChange={(event) => { setNote(event.target.value); setNoteMessage(null); }}
        maxLength={2000} rows={5} disabled={notePending} className={styles.note} aria-describedby={`${noteId}-hint`} />
      <p id={`${noteId}-hint`} className={styles.counter}>{note.length.toLocaleString("en-GB")} / 2,000</p>
      {noteConflict && <div className={styles.conflict}><span>Currently saved note</span><p>{savedNote.value || "No saved note."}</p></div>}
      <div className={styles.actions}>
        <button type="submit" className="btnAccent" disabled={notePending || (note.trim() || null) === savedNote.value}>{notePending ? "Saving…" : "Save note"}</button>
        {savedNote.value !== null && <button type="button" className="btnGhost" disabled={notePending} onClick={() => void saveNote(null)}>Clear note</button>}
      </div>
      {noteError && <p className={styles.error} role="alert">{noteError}</p>}
      <p className={styles.status} role="status">{noteMessage || (notePending ? "Saving note…" : "")}</p>
    </form>
  </section>;
}
