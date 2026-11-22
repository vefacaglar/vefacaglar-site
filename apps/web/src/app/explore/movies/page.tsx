import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import styles from "./movies.module.css";
import { getDictionary } from "../../../dictionaries";
import { getActiveLanguage } from "../../../lib/lang";
import { localizedAlternates } from "../../../lib/seo";
import { libraryMetadata } from "../../../lib/librarySeo";
import { MOVIE_SUGGESTION_GROUPS, getMovieAudienceSources, getMovieRankingNotice, getPublicMovies, searchMoviePeople } from "../../../lib/movies";
import LibraryMasthead from "../../../components/library/LibraryMasthead";
import MovieSearch from "../../../components/movies/MovieSearch";
import Pagination from "../../components/Pagination";
import MovieCards from "../../../components/movies/MovieCards";
import MoviePeopleList from "../../../components/movies/MoviePeopleList";

export async function generateMetadata() {
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  return libraryMetadata({
    section: "movies", title: dict.movies, description: dict.movies_catalog_subtitle,
    alternates: localizedAlternates("/explore/movies", lang),
  });
}

/** The people section is auxiliary: if it fails, the film results still render in the default order. */
async function matchingPeople(query: string) {
  try {
    const result = await searchMoviePeople(query);
    return { people: result?.items ?? [], order: result?.order ?? MOVIE_SUGGESTION_GROUPS };
  } catch (error) {
    unstable_rethrow(error);
    return { people: [], order: MOVIE_SUGGESTION_GROUPS };
  }
}

export default async function Movies({ searchParams }: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const query = params.q?.trim() || "";
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  const [data, matches] = await Promise.all([
    getPublicMovies(page, query || undefined),
    query && page === 1 ? matchingPeople(query) : Promise.resolve({ people: [], order: MOVIE_SUGGESTION_GROUPS }),
  ]);
  const { people } = matches;
  const audienceSources = !query ? getMovieAudienceSources(data?.ranking) : [];
  const rankingNotice = !query ? getMovieRankingNotice(data?.ranking) : null;
  const peopleSection = people.length > 0 && (
    <section key="people" className={styles.section} aria-labelledby="movie-search-people">
      <h2 id="movie-search-people" className={styles.sectionTitle}>{dict.movies_search_people}</h2>
      <MoviePeopleList people={people} lang={lang} />
    </section>
  );
  const titlesSection = data?.items.length ? (
    <section key="movies" className={styles.section} aria-labelledby={people.length ? "movie-search-titles" : undefined}>
      {people.length > 0 && <h2 id="movie-search-titles" className={styles.sectionTitle}>{dict.movies_search_titles}</h2>}
      <MovieCards movies={data.items} lang={lang} />
      <Pagination currentPage={page} totalPages={data.totalPages} className={styles.pagination}
        labels={{ previous: dict.library_previous, next: dict.library_next, pageOf: dict.library_page_of }} />
    </section>
  ) : !people.length && <p key="movies" className={styles.empty}>{query ? dict.movies_no_results : dict.movies_catalog_empty}</p>;
  return (
    <div>
      <LibraryMasthead title={dict.movies} subtitle={dict.movies_catalog_subtitle}>
        <MovieSearch initialQuery={query} placeholder={dict.movies_search_placeholder} />
      </LibraryMasthead>
      {audienceSources.length > 0 && <p className={styles.ranking}>
        {data?.ranking.mode === "combined_popularity" ? "Current popularity" : "Current audience interest"}
        {audienceSources.map((source) => <span key={source.provider}> · <a href={source.href}>{source.label}</a> {source.window}</span>)}
        {" · "}<Link href="/credits">Data credits</Link>
      </p>}
      {!query && data && !audienceSources.length && (rankingNotice || data.ranking.mode === "recognition") && <p className={styles.ranking}>
        {rankingNotice ? <>{data.ranking.windowDays === 3 ? "Recent Wikipedia interest (3 days)" : "Wikipedia interest"} · {rankingNotice.date}. <a href={rankingNotice.sourceUrl}>Source</a></>
          : "Ordered by Wikipedia language coverage."}
      </p>}
      {matches.order.map((group) => group === "people" ? peopleSection : titlesSection)}
    </div>
  );
}
