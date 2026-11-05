import { notFound } from "next/navigation";
import styles from "../../profile.module.css";
import { getActiveLanguage } from "../../../../lib/lang";
import { getDictionary } from "../../../../dictionaries";
import { decodeUsername, getProfileLibrary, profilePath } from "../../../../lib/profileLibrary";
import ProfileGamesShelf from "../../components/ProfileGamesShelf";
import ProfileEmpty from "../../components/ProfileEmpty";
import PrivateProfile from "../../components/PrivateProfile";

interface ProfileGamesProps {
  params: Promise<{ username: string }>;
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

  return (
    <ProfileGamesShelf
      games={games}
      summaryPlatforms={summary.platforms}
      lang={lang}
      isOwner={isOwner}
      ownerName={user.displayName || user.username}
    />
  );
}
