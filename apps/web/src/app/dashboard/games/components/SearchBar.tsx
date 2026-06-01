import React from "react";
import styles from "./SearchBar.module.css";
import { SubTab } from "../types";
import { GamesViewMode } from "../hooks/useGamesViewMode";
import ds from "../../../../lib/dashboard-strings";

interface SearchBarProps {
  activeTab: SubTab;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  viewMode?: GamesViewMode;
  onViewModeChange?: (mode: GamesViewMode) => void;
}

export default function SearchBar({
  activeTab,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  viewMode,
  onViewModeChange,
}: SearchBarProps) {
  const placeholder =
    activeTab === "games"
      ? ds.games.search.games
      : ds.games.search.template.replace("{type}", activeTab);

  const showViewToggle = activeTab === "games" && viewMode && onViewModeChange;

  return (
    <div className={styles.searchBarContainer}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
        className={styles.searchForm}
      >
        <input
          type="text"
          className={styles.searchInput}
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </form>

      {showViewToggle && (
        <div className={styles.viewToggleBtnGroup}>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === "grid" ? styles.viewToggleBtnActive : ""}`}
            onClick={() => onViewModeChange!("grid")}
            title={ds.games.buttons.gridView}
          >
            {ds.games.buttons.gridView}
          </button>
          <button
            type="button"
            className={`${styles.viewToggleBtn} ${viewMode === "list" ? styles.viewToggleBtnActive : ""}`}
            onClick={() => onViewModeChange!("list")}
            title={ds.games.buttons.listView}
          >
            {ds.games.buttons.listView}
          </button>
        </div>
      )}
    </div>
  );
}
