import { notFound } from "next/navigation";
import Link from "next/link";
import styles from "../../profile.module.css";
import { getActiveLanguage } from "../../../../lib/lang";
import { getDictionary } from "../../../../dictionaries";
import { localizeHref } from "../../../../lib/localizeHref";
import { decodeUsername, getProfileLibrary, profilePath } from "../../../../lib/profileLibrary";
import { statusLabel } from "../../../games/gameLogStatus";
import ProfileGameGrid from "../../components/ProfileGameGrid";
import ProfileGameList from "../../components/ProfileGameList";
import ProfilePlatforms from "../../components/ProfilePlatforms";
import ProfileEmpty from "../../components/ProfileEmpty";
import PrivateProfile from "../../components/PrivateProfile";
import {
  SHELF_TABS,
  defaultSort,
  parseSort,
  parseTab,
  parseView,
  platformCounts,
  shelfQuery,
  sortShelf,
  sortsFor,
  type ShelfSort,
  type ShelfView,
} from "../../libraryShelf";

interface ProfileGamesProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ status?: string | string[]; sort?: string | string[]; view?: string | string[] }>;
}

/** Every game on the user's shelf, split by status, in the order the reader picks. */
export default async function ProfileGames(props: ProfileGamesProps) {
  const { username } = await props.params;
  const handle = decodeUsername(username);
  const result = await getProfileLibrary(handle);
  if (result.kind === "not_found") notFound();

  const lang = await getActiveLanguage();
  if (result.kind === "private") {
    return (
      <PrivateProfile username={handle} path={profilePath(handle, "games")} signedIn={result.signedIn} lang={lang} />
    );
  }

  const dict = getDictionary(lang);
  const { games, user, isOwner, summary } = result.data;

  if (games.length === 0) {
    return (
      <section>
        <h2 className={styles.visuallyHidden}>{dict.games}</h2>
        <ProfileEmpty isOwner={isOwner} name={user.displayName || user.username} lang={lang} />
      </section>
    );
  }

  const searchParams = await props.searchParams;
  const tab = parseTab(searchParams.status);
  const sort = parseSort(searchParams.sort, tab);
  const view = parseView(searchParams.view);
  const basePath = profilePath(user.username, "games");

  const countOf = (t: (typeof SHELF_TABS)[number]) =>
    t === "all" ? games.length : games.filter((game) => game.status === t).length;
  // Empty statuses stay out of the row, unless the URL lands on one directly.
  const tabs = SHELF_TABS.map((t) => ({ key: t, count: countOf(t) })).filter(
    (t) => t.key === "all" || t.key === tab || t.count > 0,
  );

  const shown = sortShelf(tab === "all" ? games : games.filter((game) => game.status === tab), sort);

  // The whole shelf uses the API's counts; a status tab counts just its own games.
  const platforms = tab === "all" && summary.platforms.length > 0 ? summary.platforms : platformCounts(shown);

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
          <nav className={styles.statusTabs} aria-label={dict.profile_status_tabs}>
            {tabs.map((t) => {
              const active = t.key === tab;
              return (
                <Link
                  key={t.key}
                  href={localizeHref(`${basePath}${shelfQuery(t.key, defaultSort(t.key), view)}`, lang)}
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
                      href={localizeHref(`${basePath}${shelfQuery(tab, s, view)}`, lang)}
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

            <nav className={styles.viewToggle} aria-label={dict.profile_view_label}>
              {(["grid", "list"] as const).map((v) => {
                const active = v === view;
                return (
                  <Link
                    key={v}
                    href={localizeHref(`${basePath}${shelfQuery(tab, sort, v)}`, lang)}
                    scroll={false}
                    className={active ? `${styles.viewOption} ${styles.viewOptionActive}` : styles.viewOption}
                    aria-current={active ? "true" : undefined}
                  >
                    {v === "grid" ? <GridIcon /> : <ListIcon />}
                    <span>{viewLabels[v]}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className={`${styles.muted} ${styles.shelfEmpty}`}>
            {tab === "all" ? dict.no_library : dict[`profile_empty_${tab}` as const]}
          </p>
        ) : view === "list" ? (
          <ProfileGameList
            games={shown}
            lang={lang}
            isOwner={isOwner}
            ownerName={user.displayName || user.username}
            sortedByPlaytime={sort === "playtime"}
            showCompletedAt={sort === "completed"}
          />
        ) : (
          <ProfileGameGrid
            games={shown}
            lang={lang}
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
