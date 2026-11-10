import Link from "next/link";
import ExploreGrid, { type ExploreGame } from "../../components/explore/ExploreGrid";
import LibraryMasthead from "../../components/library/LibraryMasthead";
import { getPublicGames } from "../../lib/data";
import { getActiveLanguage } from "../../lib/lang";
import { libraryMetadata } from "../../lib/librarySeo";
import { localizeHref } from "../../lib/localizeHref";
import { getPublicMovies } from "../../lib/movies";
import { localizedAlternates } from "../../lib/seo";
import styles from "./explore.module.css";

const DESCRIPTION = "Discover games and movies.";
const PREVIEW_SIZE = 6;

export async function generateMetadata() {
  const lang = await getActiveLanguage();
  return libraryMetadata({
    title: "Explore",
    description: DESCRIPTION,
    alternates: localizedAlternates("/explore", lang),
  });
}

export default async function ExplorePage() {
  const [lang, gamesData, moviesData] = await Promise.all([
    getActiveLanguage(),
    getPublicGames(1),
    getPublicMovies(1),
  ]);
  const games: ExploreGame[] = ((gamesData?.items ?? []) as { slug: string; title: string; releaseDate: string | null }[])
    .slice(0, PREVIEW_SIZE)
    .map(({ slug, title, releaseDate }) => ({ slug, title, releaseDate }));
  const movies = (moviesData?.items ?? []).slice(0, PREVIEW_SIZE);

  return <div>
    <LibraryMasthead title="Explore" subtitle={DESCRIPTION} />
    <section className={styles.section} aria-labelledby="explore-games">
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle} id="explore-games">Games</h2>
        <Link className={styles.viewAll} href={localizeHref("/explore/games", lang)}>View all games</Link>
      </div>
      <ExploreGrid games={games} movies={[]} lang={lang} emptyMessage="No games are available yet." />
    </section>
    <section className={styles.section} aria-labelledby="explore-movies">
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle} id="explore-movies">Movies</h2>
        <Link className={styles.viewAll} href={localizeHref("/explore/movies", lang)}>View all movies</Link>
      </div>
      <ExploreGrid games={[]} movies={movies} lang={lang} emptyMessage="No movies are available yet." />
    </section>
  </div>;
}
