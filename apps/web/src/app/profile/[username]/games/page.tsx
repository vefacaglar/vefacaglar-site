import { notFound } from "next/navigation";
import styles from "../../profile.module.css";
import { getActiveLanguage } from "../../../../lib/lang";
import { getDictionary } from "../../../../dictionaries";
import { decodeUsername, getProfileLibrary, profilePath } from "../../../../lib/profileLibrary";
import ProfileGamesShelf from "../../components/ProfileGamesShelf";
import ProfilePlatforms from "../../components/ProfilePlatforms";
import ProfileEmpty from "../../components/ProfileEmpty";
import PrivateProfile from "../../components/PrivateProfile";
import {
  SHELF_TABS,
  parseTab,
  platformCounts,
} from "../../libraryShelf";

interface ProfileGamesProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
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
  const basePath = profilePath(user.username, "games");

  const countOf = (t: (typeof SHELF_TABS)[number]) =>
    t === "all" ? games.length : games.filter((game) => game.status === t).length;
  // Empty statuses stay out of the row, unless the URL lands on one directly.
  const tabs = SHELF_TABS.map((t) => ({ key: t, count: countOf(t) })).filter(
    (t) => t.key === "all" || t.key === tab || t.count > 0,
  );

  const filtered = tab === "all" ? games : games.filter((game) => game.status === tab);

  // The whole shelf uses the API's counts; a status tab counts just its own games.
  const platforms = tab === "all" && summary.platforms.length > 0 ? summary.platforms : platformCounts(filtered);
  const emptyMessage = tab === "all" ? dict.no_library : dict[`profile_empty_${tab}` as const];

  return (
    <>
      <ProfileGamesShelf
        games={filtered}
        lang={lang}
        isOwner={isOwner}
        ownerName={user.displayName || user.username}
        basePath={basePath}
        tab={tab}
        tabs={tabs}
        emptyMessage={emptyMessage}
      />

      {filtered.length > 0 && platforms.length > 0 && <ProfilePlatforms platforms={platforms} lang={lang} />}
    </>
  );
}
