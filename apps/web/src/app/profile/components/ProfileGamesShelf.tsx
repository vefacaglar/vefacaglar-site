"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../profile.module.css";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import type { LibraryGame } from "../../../lib/profileLibrary";
import { statusLabel } from "../../games/gameLogStatus";
import ProfileGameGrid from "./ProfileGameGrid";
import ProfileGameList from "./ProfileGameList";
import {
  defaultSort,
  readStoredView,
  shelfQuery,
  sortsFor,
  writeStoredView,
  type ShelfSort,
  type ShelfTab,
  type ShelfView,
} from "../libraryShelf";

type ProfileGamesShelfProps = {
  shown: LibraryGame[];
  lang: string;
  isOwner: boolean;
  ownerName: string;
  basePath: string;
  tab: ShelfTab;
  tabs: { key: ShelfTab; count: number }[];
  sort: ShelfSort;
  emptyMessage: string;
};

export default function ProfileGamesShelf({
  shown,
  lang,
  isOwner,
  ownerName,
  basePath,
  tab,
  tabs,
  sort,
  emptyMessage,
}: ProfileGamesShelfProps) {
  const dict = getDictionary(lang);
  const [view, setView] = useState<ShelfView>("grid");

  useEffect(() => {
    setView(readStoredView(window.localStorage));
  }, []);

  const selectView = (nextView: ShelfView) => {
    setView(nextView);
    writeStoredView(nextView, window.localStorage);
  };

  const viewLabels: Record<ShelfView, string> = {
    grid: dict.profile_view_grid,
    list: dict.profile_view_list,
  };

  const sortLabels: Record<ShelfSort, string> = {
    activity: dict.sort_activity,
    playtime: dict.sort_playtime,
    completed: dict.sort_completed,
  };

  return (
    <section>
      <h2 className={styles.visuallyHidden}>{dict.games}</h2>

      <div className={styles.shelfBar}>
        <nav className={styles.statusTabs} aria-label={dict.profile_status_tabs}>
          {tabs.map((t) => {
            const active = t.key === tab;
            return (
              <Link
                key={t.key}
                href={localizeHref(`${basePath}${shelfQuery(t.key, defaultSort(t.key))}`, lang)}
                scroll={false}
                className={active ? `${styles.statusTab} ${styles.statusTabActive}` : styles.statusTab}
                aria-current={active ? "page" : undefined}
              >
                {t.key === "all" ? dict.profile_status_all : statusLabel(dict, t.key)}
                <span className={styles.tabCount}>{t.count}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.shelfTools}>
          {shown.length > 0 && (
            <nav className={styles.sortBar} aria-label={dict.profile_sort_label}>
              <span className={styles.sortLabel} aria-hidden="true">
                {dict.profile_sort_label}
              </span>
              {sortsFor(tab).map((s) => {
                const active = s === sort;
                return (
                  <Link
                    key={s}
                    href={localizeHref(`${basePath}${shelfQuery(tab, s)}`, lang)}
                    scroll={false}
                    className={active ? `${styles.sortOption} ${styles.sortOptionActive}` : styles.sortOption}
                    aria-current={active ? "true" : undefined}
                  >
                    {sortLabels[s]}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className={styles.viewToggle} role="group" aria-label={dict.profile_view_label}>
            {(["grid", "list"] as const).map((v) => {
              const active = v === view;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => selectView(v)}
                  className={active ? `${styles.viewOption} ${styles.viewOptionActive}` : styles.viewOption}
                  aria-pressed={active}
                >
                  {v === "grid" ? <GridIcon /> : <ListIcon />}
                  <span>{viewLabels[v]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className={`${styles.muted} ${styles.shelfEmpty}`}>{emptyMessage}</p>
      ) : view === "list" ? (
        <ProfileGameList
          games={shown}
          lang={lang}
          isOwner={isOwner}
          ownerName={ownerName}
          sortedByPlaytime={sort === "playtime"}
          showCompletedAt={sort === "completed"}
        />
      ) : (
        <ProfileGameGrid
          games={shown}
          lang={lang}
          isOwner={isOwner}
          showCompletedAt={sort === "completed"}
          hideStatus={tab !== "all"}
        />
      )}
    </section>
  );
}

function GridIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={styles.viewIcon}>
      <rect x="0" y="0" width="5" height="5" />
      <rect x="7" y="0" width="5" height="5" />
      <rect x="0" y="7" width="5" height="5" />
      <rect x="7" y="7" width="5" height="5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={styles.viewIcon}>
      <rect x="0" y="0.5" width="12" height="1.5" />
      <rect x="0" y="5.25" width="12" height="1.5" />
      <rect x="0" y="10" width="12" height="1.5" />
    </svg>
  );
}
