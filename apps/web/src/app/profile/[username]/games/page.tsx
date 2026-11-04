import { notFound } from "next/navigation";
import styles from "../../profile.module.css";
import { getActiveLanguage } from "../../../../lib/lang";
import { getDictionary } from "../../../../dictionaries";
import { decodeUsername, getProfileLibrary, profilePath } from "../../../../lib/profileLibrary";
import ProfileGameGrid from "../../components/ProfileGameGrid";
import ProfileEmpty from "../../components/ProfileEmpty";
import PrivateProfile from "../../components/PrivateProfile";

interface ProfileGamesProps {
  params: Promise<{ username: string }>;
}

/** Every game on the user's shelf, most recently logged first. */
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
  const sorted = [...games].sort((a, b) => Date.parse(b.lastLoggedAt) - Date.parse(a.lastLoggedAt));

  return (
    <section>
      <h2 className={styles.visuallyHidden}>{dict.games}</h2>
      {sorted.length === 0 ? (
        <ProfileEmpty isOwner={isOwner} name={user.displayName || user.username} lang={lang} />
      ) : (
        <ProfileGameGrid games={sorted} lang={lang} />
      )}
    </section>
  );
}
