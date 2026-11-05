"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import styles from "../profile.module.css";
import { getDictionary } from "../../../dictionaries";
import type { LibraryGame, LibraryPlatformCount } from "../../../lib/profileLibrary";
import { statusLabel } from "../../games/gameLogStatus";
import ProfileGameGrid from "./ProfileGameGrid";
import ProfileGameList from "./ProfileGameList";
import ProfilePlatforms from "./ProfilePlatforms";
import {
  SHELF_TABS,
  platformCounts,
  readStoredSort,
  readStoredTab,
  readStoredView,
  sortsFor,
  sortShelf,
  writeStoredSort,
  writeStoredTab,
  writeStoredView,
  type ShelfSort,
  type ShelfTab,
  type ShelfView,
} from "../libraryShelf";

type ProfileGamesShelfProps = {
  games: LibraryGame[];
  summaryPlatforms: LibraryPlatformCount[];
  lang: string;
  isOwner: boolean;
  ownerName: string;
};

const emptySubscribe = () => () => {};

/**
 * Client-side games shelf so `localStorage` preferences (`view`, `sort`, `tab`)
 * are read synchronously on first client mount without any SSR flash or server round-trip.
 */
export default function ProfileGamesShelf(props: ProfileGamesShelfProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return <ProfileGamesShelfClient {...props} />;
}

function ProfileGamesShelfClient({
  games,
  summaryPlatforms,
  lang,
  isOwner,
  ownerName,
}: ProfileGamesShelfProps) {
  const dict = getDictionary(lang);

  const [tab, setTab] = useState<ShelfTab>(() => {
    const stored = readStoredTab(window.localStorage);
    return stored !== "all" && !games.some((g) => g.status === stored) ? "all" : stored;
  });
  const [view, setView] = useState<ShelfView>(() => readStoredView(window.localStorage));
  const [sort, setSort] = useState<ShelfSort>(() => readStoredSort(tab, window.localStorage));

  const selectTab = (nextTab: ShelfTab) => {
    setTab(nextTab);
    writeStoredTab(nextTab, window.localStorage);
    // Keep sort valid for the newly selected tab.
    setSort((currentSort) => {
      const allowed = sortsFor(nextTab);
      if (allowed.includes(currentSort)) return currentSort;
      return readStoredSort(nextTab, window.localStorage);
    });
  };

  const selectView = (nextView: ShelfView) => {
    setView(nextView);
    writeStoredView(nextView, window.localStorage);
  };

  const selectSort = (nextSort: ShelfSort) => {
    setSort(nextSort);
    writeStoredSort(nextSort, window.localStorage);
  };

  const tabs = useMemo(() => {
    const countOf = (t: ShelfTab) =>
      t === "all" ? games.length : games.filter((game) => game.status === t).length;
    return SHELF_TABS.map((t) => ({ key: t, count: countOf(t) })).filter(
      (t) => t.key === "all" || t.key === tab || t.count > 0,
    );
  }, [games, tab]);

  const filtered = useMemo(
    () => (tab === "all" ? games : games.filter((game) => game.status === tab)),
    [games, tab],
  );

  const shown = useMemo(() => sortShelf(filtered, sort), [filtered, sort]);

  const platforms = useMemo(
    () => (tab === "all" && summaryPlatforms.length > 0 ? summaryPlatforms : platformCounts(filtered)),
    [filtered, summaryPlatforms, tab],
  );

  const emptyMessage = tab === "all" ? dict.no_library : dict[`profile_empty_${tab}` as const];

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
    <>
      <section>
        <h2 className={styles.visuallyHidden}>{dict.games}</h2>

        <div className={styles.shelfBar}>
          <div className={styles.statusTabs} role="tablist" aria-label={dict.profile_status_tabs}>
            {tabs.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(t.key)}
                  className={active ? `${styles.statusTab} ${styles.statusTabActive}` : styles.statusTab}
                >
                  {t.key === "all" ? dict.profile_status_all : statusLabel(dict, t.key)}
                  <span className={styles.tabCount}>{t.count}</span>
                </button>
              );
            })}
          </div>

          <div className={styles.shelfTools}>
            {shown.length > 0 && (
              <div className={styles.sortBar} role="group" aria-label={dict.profile_sort_label}>
                <span className={styles.sortLabel} aria-hidden="true">
                  {dict.profile_sort_label}
                </span>
                {sortsFor(tab).map((s) => {
                  const active = s === sort;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => selectSort(s)}
                      className={active ? `${styles.sortOption} ${styles.sortOptionActive}` : styles.sortOption}
                      aria-pressed={active}
                    >
                      {sortLabels[s]}
                    </button>
                  );
                })}
              </div>
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

      {shown.length > 0 && platforms.length > 0 && <ProfilePlatforms platforms={platforms} lang={lang} />}
    </>
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
