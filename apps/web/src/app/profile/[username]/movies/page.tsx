import { notFound } from "next/navigation";
import styles from "../../profile.module.css";
import { getActiveLanguage } from "../../../../lib/lang";
import { getDictionary } from "../../../../dictionaries";
import { decodeUsername, getProfileLibrary, profilePath } from "../../../../lib/profileLibrary";
import PrivateProfile from "../../components/PrivateProfile";

interface ProfileMoviesProps {
  params: Promise<{ username: string }>;
}

/** Placeholder until movie logs exist. */
export default async function ProfileMovies(props: ProfileMoviesProps) {
  const { username } = await props.params;
  const handle = decodeUsername(username);
  // Same per-request fetch as the layout: decides between private, missing and visible.
  const result = await getProfileLibrary(handle);
  if (result.kind === "not_found") notFound();

  const lang = await getActiveLanguage();
  if (result.kind === "private") {
    return (
      <PrivateProfile username={handle} path={profilePath(handle, "movies")} signedIn={result.signedIn} lang={lang} />
    );
  }

  const dict = getDictionary(lang);
  return (
    <section className={styles.empty}>
      <h2 className={styles.emptyTitle}>{dict.movies_empty_title}</h2>
      <p className={styles.muted}>{dict.profile_movies_empty}</p>
    </section>
  );
}
