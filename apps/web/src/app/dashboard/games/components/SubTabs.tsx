import React from "react";
import styles from "./SubTabs.module.css";
import { SubTab } from "../types";
import ds from "../../../../lib/dashboard-strings";

interface SubTabsProps {
  activeTab: SubTab;
  counts: Partial<Record<SubTab, number>>;
  onChange: (tab: SubTab) => void;
}

const TABS: SubTab[] = ["games", "developers", "publishers", "genres", "themes", "platforms"];

const LABELS: Record<SubTab, string> = {
  games: ds.games.tabs.games,
  developers: ds.games.tabs.developers,
  publishers: ds.games.tabs.publishers,
  genres: ds.games.tabs.genres,
  themes: ds.games.tabs.themes,
  platforms: ds.games.tabs.platforms,
};

export default function SubTabs({ activeTab, counts, onChange }: SubTabsProps) {
  return (
    <div className={styles.subTabsContainer}>
      {TABS.map((tab) => {
        const count = counts[tab];
        return (
          <button
            key={tab}
            type="button"
            className={`${styles.subTabButton} ${activeTab === tab ? styles.subTabButtonActive : ""}`}
            onClick={() => onChange(tab)}
          >
            {LABELS[tab]}
            {count !== undefined && <span className={styles.subTabBadge}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
