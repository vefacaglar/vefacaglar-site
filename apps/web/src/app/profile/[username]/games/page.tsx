import { notFound } from "next/navigation";
import Link from "next/link";
import styles from "../../profile.module.css";
import { getActiveLanguage } from "../../../../lib/lang";
import { getDictionary } from "../../../../dictionaries";
import { localizeHref } from "../../../../lib/localizeHref";
import { decodeUsername, getProfileLibrary, profilePath } from "../../../../lib/profileLibrary";
import { statusLabel } from "../../../games/gameLogStatus";
import ProfileGameGrid from "../../components/ProfileGameGrid";
import ProfileEmpty from "../../components/ProfileEmpty";
import PrivateProfile from "../../components/PrivateProfile";
import {
  SHELF_TABS,
  defaultSort,
  parseSort,
  parseTab,
  shelfQuery,
  sortShelf,
  sortsFor,
  type ShelfSort,
} from "../../libraryShelf";

interface ProfileGamesProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ status?: string | string[]; sort?: string | string[] }>;
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
  const { games, user, isOwner } = result.data;

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
  const basePath = profilePath(user.username, "games");

  const countOf = (t: (typeof SHELF_TABS)[number]) =>
    t === "all" ? games.length : games.filter((game) => game.status === t).length;
  // Empty statuses stay out of the row, unless the URL lands on one directly.
  const tabs = SHELF_TABS.map((t) => ({ key: t, count: countOf(t) })).filter(
    (t) => t.key === "all" || t.key === tab || t.count > 0,
  );

  const shown = sortShelf(tab === "all" ? games : games.filter((game) => game.status === tab), sort);

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
      </div>

      {shown.length === 0 ? (
        <p className={`${styles.muted} ${styles.shelfEmpty}`}>
          {tab === "all" ? dict.no_library : dict[`profile_empty_${tab}` as const]}
        </p>
      ) : (
        <ProfileGameGrid
          games={shown}
          lang={lang}
          showCompletedAt={sort === "completed"}
          hideStatus={tab !== "all"}
        />
      )}
    </section>
  );
}
