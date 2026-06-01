import React from "react";
import styles from "./forms.module.css";
import { GameRelationItem, RelationKind } from "../types";
import RelationPicker, { RelationFetchAction } from "./RelationPicker";
import LazyRelationPicker from "./LazyRelationPicker";
import ds from "../../../../lib/dashboard-strings";

export interface RelationsGridHandlers {
  toggle: (kind: RelationKind, rel: GameRelationItem) => void;
  fetchDevelopers: RelationFetchAction;
  fetchPublishers: RelationFetchAction;
  isLoading: boolean;
  options: { genres: GameRelationItem[]; themes: GameRelationItem[]; platforms: GameRelationItem[] } | null;
  selectedDevelopers: GameRelationItem[];
  selectedPublishers: GameRelationItem[];
  selectedGenres: GameRelationItem[];
  selectedPlatforms: GameRelationItem[];
  selectedThemes: GameRelationItem[];
  disabled?: boolean;
}

export default function RelationsGrid({
  toggle,
  fetchDevelopers,
  fetchPublishers,
  isLoading,
  options,
  selectedDevelopers,
  selectedPublishers,
  selectedGenres,
  selectedPlatforms,
  selectedThemes,
  disabled,
}: RelationsGridHandlers) {
  return (
    <div>
      <div className={styles.formSectionTitle}>{ds.games.form.relations}</div>
      <div className={styles.relationsGrid}>
        <RelationPicker
          label={ds.games.form.developers}
          fetchAction={fetchDevelopers}
          selected={selectedDevelopers}
          onToggle={(rel) => toggle("developers", rel)}
          disabled={disabled}
        />
        <RelationPicker
          label={ds.games.form.publishers}
          fetchAction={fetchPublishers}
          selected={selectedPublishers}
          onToggle={(rel) => toggle("publishers", rel)}
          disabled={disabled}
        />
        <LazyRelationPicker
          label={ds.games.form.genres}
          selected={selectedGenres}
          allOptions={options?.genres || []}
          onToggle={(rel) => toggle("genres", rel)}
          disabled={disabled}
          loading={isLoading}
        />
        <LazyRelationPicker
          label={ds.games.form.platforms}
          selected={selectedPlatforms}
          allOptions={options?.platforms || []}
          onToggle={(rel) => toggle("platforms", rel)}
          disabled={disabled}
          loading={isLoading}
        />
        <LazyRelationPicker
          label={ds.games.form.themes}
          selected={selectedThemes}
          allOptions={options?.themes || []}
          onToggle={(rel) => toggle("themes", rel)}
          disabled={disabled}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
