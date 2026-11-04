import Link from "next/link";
import styles from "./movies.module.css";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import { localizedAlternates } from "../../lib/seo";
import { libraryMetadata } from "../../lib/librarySeo";
import LibraryMasthead from "../../components/library/LibraryMasthead";

export async function generateMetadata() {
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  return libraryMetadata({
    section: "movies",
    title: dict.movies,
    description: dict.movies_subtitle,
    alternates: localizedAlternates("/movies", lang),
    // Nothing to index until the shelf has movies on it.
    robots: { index: false },
  });
}

export default async function Movies() {
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);

  return (
    <div>
      <LibraryMasthead title={dict.movies} subtitle={dict.movies_subtitle} />

      {/* Placeholder until movies are added; the shelf will use the games layout. */}
      <section className={styles.empty} aria-labelledby="movies-empty-title">
        <h2 id="movies-empty-title" className={styles.emptyTitle}>
          {dict.movies_empty_title}
        </h2>
        <p className={styles.emptyBody}>{dict.movies_empty_body}</p>
        <Link href={localizeHref("/games", lang)} className="btnGhost">
          {dict.browse_games}
        </Link>
      </section>
    </div>
  );
}
