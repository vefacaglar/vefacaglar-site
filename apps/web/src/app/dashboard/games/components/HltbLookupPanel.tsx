"use client";
import { useState } from "react";
import Button from "../../../../components/Button";
import { applyHltbAction, lookupHltbAction, retryHltbSyncAction } from "../actions";
import type { HltbApplied, HltbLookup, HltbTimes } from "../hltb-types";
import styles from "./HltbLookupPanel.module.css";
const fields = ["mainHours", "mainExtraHours", "completionistHours"] as const;
const labels = { mainHours: "Main story", mainExtraHours: "Main + extras", completionistHours: "Completionist" };
export default function HltbLookupPanel({ gameId, title, durationDirty, disabled, onApplied, onDiscard, onBusyChange }: {
  gameId: string; title: string; durationDirty: boolean; disabled: boolean;
  onApplied: (times: HltbTimes) => void; onDiscard: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [query, setQuery] = useState(title);
  const [lookup, setLookup] = useState<HltbLookup | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [overwrite, setOverwrite] = useState<(keyof HltbTimes)[]>([]);
  const [remap, setRemap] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const candidate = lookup?.candidates.find((item) => item.hltbId === selected);
  const needsRemap = !!(candidate && lookup?.game.hltbId && lookup.game.hltbId !== candidate.hltbId);
  const needsMismatch = !!candidate?.warnings.some((warning) => warning.includes("differs"));
  const run = async (work: () => Promise<void>) => {
    setBusy(true); onBusyChange(true); setStatus("");
    try { await work(); } catch { setStatus("The request failed. Try again."); }
    finally { setBusy(false); onBusyChange(false); }
  };
  const search = () => run(async () => {
    const response = await lookupHltbAction(gameId, { query });
    if ("error" in response) { setStatus(response.error); return; }
    setLookup(response.data); setSelected(null); setOverwrite([]); setRemap(false); setMismatch(false); setPending(response.data.pendingSearchSync);
    if (response.data.outcome === "provider_unavailable") setStatus(`HowLongToBeat is temporarily unavailable.${response.data.retryAfter ? ` Try again after ${new Date(response.data.retryAfter).toLocaleString()}.` : ""}`);
    else if (response.data.outcome === "no_match") setStatus("No entries found. Try a shorter or alternate title.");
  });
  const saved = (result: HltbApplied) => {
    onApplied(result.game.times); setPending(result.searchSync === "pending"); setLookup(null); setSelected(null);
    setStatus(result.searchSync === "pending" ? "Saved; search update pending. You can retry the search update." : "HowLongToBeat mapping and completion times saved.");
  };
  const apply = () => run(async () => {
    if (!lookup || selected === null || durationDirty) return;
    const response = await applyHltbAction(gameId, { receiptId: lookup.receiptId, expectedVersion: lookup.expectedVersion, hltbId: selected,
      overwriteFields: overwrite, replaceMapping: remap, acknowledgeMismatch: mismatch });
    if ("error" in response) { setStatus(response.error); return; }
    saved(response.data);
  });
  const retry = () => run(async () => {
    const response = await retryHltbSyncAction(gameId);
    if ("error" in response) { setStatus(response.error); return; }
    setPending(response.data.searchSync === "pending");
    setStatus(response.data.searchSync === "pending" ? "Search update is still pending. Try again later." : "Search updated.");
  });
  return <section className={styles.panel} aria-label="HowLongToBeat lookup">
    <h2 className={styles.title}>HowLongToBeat</h2>
    <p className={styles.muted}>Search and review an entry before applying it. Existing completion times are preserved unless you choose to replace them. Availability depends on HowLongToBeat&apos;s public website.</p>
    <div className={styles.controls}>
      <label className={styles.query}>Game title<input value={query} maxLength={250} disabled={busy || disabled} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy && !disabled && query.trim()) void search(); } }} /></label>
      <Button type="button" variant="ghost" onClick={search} disabled={busy || disabled || !query.trim()}>{busy ? "Working…" : "Search HowLongToBeat"}</Button>
    </div>
    {lookup?.game.hltbId && <p className={styles.muted}>Current mapping: <a href={`https://howlongtobeat.com/game/${lookup.game.hltbId}`} target="_blank" rel="noreferrer">HLTB #{lookup.game.hltbId}</a> ({lookup.game.mappingSource}).</p>}
    {lookup?.candidates.length ? <ul className={styles.results}>{lookup.candidates.map((item) => <li key={item.hltbId} className={styles.candidate}>
      <label className={styles.selection}><input type="radio" name={`hltb-${gameId}`} checked={selected === item.hltbId} disabled={busy || disabled} onChange={() => { setSelected(item.hltbId); setOverwrite([]); setRemap(false); setMismatch(false); }} /><span><strong>{item.title}</strong>{item.releaseYear ? ` (${item.releaseYear})` : ""}</span></label>
      <div className={styles.times}>{fields.map((field) => <span key={field}>{labels[field]}: {item.times[field] === null ? "Unavailable" : `${item.times[field]} h`}</span>)}</div>
      {item.warnings.map((warning) => <p className={styles.warning} key={warning}>{warning}</p>)}
      <a href={item.sourceUrl} target="_blank" rel="noreferrer">View on HowLongToBeat</a>
    </li>)}</ul> : null}
    {candidate && lookup && <>
      <div className={styles.options}>{fields.filter((field) => lookup.game.times[field] !== null && candidate.times[field] !== null).map((field) => <label className={styles.option} key={field}>
        <input type="checkbox" checked={overwrite.includes(field)} disabled={busy || disabled} onChange={(event) => setOverwrite((previous) => event.target.checked ? [...previous, field] : previous.filter((item) => item !== field))} />
        Replace {labels[field]}: {lookup.game.times[field]} h → {candidate.times[field]} h
      </label>)}
      {needsRemap && <label className={styles.option}><input type="checkbox" checked={remap} disabled={busy || disabled} onChange={(event) => setRemap(event.target.checked)} />Replace the existing HowLongToBeat mapping with this entry.</label>}
      {needsMismatch && <label className={styles.option}><input type="checkbox" checked={mismatch} disabled={busy || disabled} onChange={(event) => setMismatch(event.target.checked)} />I reviewed the title or release-year mismatch and want to use this entry.</label>}
      </div>
      {durationDirty && <div className={styles.status}>Save or discard duration changes first. <Button type="button" variant="ghost" disabled={busy || disabled} onClick={onDiscard}>Discard duration changes</Button></div>}
      <div className={styles.actions}><Button type="button" onClick={apply} disabled={busy || disabled || durationDirty || (needsRemap && !remap) || (needsMismatch && !mismatch)}>Apply selected entry</Button></div>
    </>}
    {status && <p className={styles.status} role="status">{status}</p>}
    {pending && <div className={styles.actions}><Button type="button" variant="ghost" onClick={retry} disabled={busy || disabled}>Retry search update</Button></div>}
  </section>;
}
