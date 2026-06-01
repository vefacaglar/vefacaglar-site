"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "./RelationPicker.module.css";
import { GameRelationItem } from "../types";
import { useDebounced } from "../hooks/useDebounced";
import { RELATION_PICKER_LIMIT } from "../constants";
import ds from "../../../../lib/dashboard-strings";

export type RelationFetchAction = (params: {
  page: number;
  limit: number;
  q: string;
}) => Promise<{ items?: any[]; error?: string }>;

interface RelationPickerProps {
  label: string;
  fetchAction: RelationFetchAction;
  selected: GameRelationItem[];
  onToggle: (rel: GameRelationItem) => void;
  disabled?: boolean;
}

export default function RelationPicker({
  label,
  fetchAction,
  selected,
  onToggle,
  disabled,
}: RelationPickerProps) {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 2000);
  const [results, setResults] = useState<GameRelationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    const trimmed = debounced.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    const reqId = ++reqRef.current;
    setLoading(true);
    fetchAction({ page: 1, limit: RELATION_PICKER_LIMIT, q: trimmed }).then((res) => {
      if (reqId !== reqRef.current) return;
      if (res && "error" in res) {
        setResults([]);
      } else {
        setResults(
          (res.items || []).map((it: any) => ({ id: it.id, name: it.name, slug: it.slug }))
        );
      }
      setLoading(false);
    });
  }, [debounced, fetchAction]);

  const selectedIds = new Set(selected.map((s) => s.id));
  const merged = [
    ...selected,
    ...results.filter((r) => !selectedIds.has(r.id)),
  ];

  return (
    <div className={styles.formGroup}>
      <label className={styles.label}>{label}</label>
      <input
        type="text"
        className={`${styles.input} ${styles.searchInputBottom}`}
        placeholder={ds.games.placeholders.searchRelation.replace("{label}", label.toLowerCase())}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
      />
      <div className={styles.checkboxGroupList}>
        {loading && merged.length === 0 ? (
          <div className={styles.fieldHint}>{ds.games.hints.loading}</div>
        ) : merged.length === 0 ? (
          <div className={styles.fieldHint}>
            {query.trim().length > 0 && query.trim().length < 3
              ? ds.games.hints.minChars
              : query.trim().length >= 3 && debounced.trim().length < 3
                ? ds.games.hints.waiting
                : ds.games.hints.noMatches}
          </div>
        ) : (
          merged.map((it) => (
            <label key={it.id} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selectedIds.has(it.id)}
                onChange={() => onToggle(it)}
                disabled={disabled}
              />
              {it.name}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
