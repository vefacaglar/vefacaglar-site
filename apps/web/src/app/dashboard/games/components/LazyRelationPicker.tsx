"use client";

import React, { useState } from "react";
import styles from "./RelationPicker.module.css";
import { GameRelationItem } from "../types";
import ds from "../../../../lib/dashboard-strings";

interface LazyRelationPickerProps {
  label: string;
  allOptions: GameRelationItem[];
  loading?: boolean;
  selected: GameRelationItem[];
  onToggle: (rel: GameRelationItem) => void;
  disabled?: boolean;
}

export default function LazyRelationPicker({
  label,
  allOptions,
  loading,
  selected,
  onToggle,
  disabled,
}: LazyRelationPickerProps) {
  const [search, setSearch] = useState("");

  if (loading) {
    return (
      <div className={styles.formGroup}>
        <label className={styles.label}>{label}</label>
        <div className={styles.fieldHint}>{ds.games.placeholders.loadingOptions}</div>
      </div>
    );
  }

  const selectedIds = new Set(selected.map((s) => s.id));
  const sortedOptions = [
    ...selected,
    ...allOptions.filter((opt) => !selectedIds.has(opt.id)),
  ];
  const filtered = sortedOptions.filter((opt) =>
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.formGroup}>
      <label className={styles.label}>{label}</label>
      <input
        type="text"
        className={`${styles.input} ${styles.searchInputBottom}`}
        placeholder={ds.games.placeholders.filterRelation.replace("{label}", label.toLowerCase())}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled}
      />
      <div className={styles.checkboxGroupList}>
        {filtered.length === 0 ? (
          <div className={styles.fieldHint}>{ds.games.placeholders.noOptions}</div>
        ) : (
          filtered.map((it) => (
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
