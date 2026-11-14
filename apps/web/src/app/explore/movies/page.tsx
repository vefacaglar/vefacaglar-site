import { unstable_rethrow } from "next/navigation";
import styles from "./movies.module.css";
import { getDictionary } from "../../../dictionaries";
import { getActiveLanguage } from "../../../lib/lang";
import { localizedAlternates } from "../../../lib/seo";
import { libraryMetadata } from "../../../lib/librarySeo";
import { getPublicMovies, searchMoviePeople } from "../../../lib/movies";
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

/** The people section is auxiliary: if it fails, the film results still render. */
async function matchingPeople(query: string) {
  try {
    return (await searchMoviePeople(query))?.items ?? [];
  } catch (error) {
    unstable_rethrow(error);
    return [];
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
  const [data, people] = await Promise.all([
    getPublicMovies(page, query || undefined),
    query && page === 1 ? matchingPeople(query) : Promise.resolve([]),
  ]);
  return (
    <div>
      <LibraryMasthead title={dict.movies} subtitle={dict.movies_catalog_subtitle}>
        <MovieSearch initialQuery={query} placeholder={dict.movies_search_placeholder} />
      </LibraryMasthead>
      {people.length > 0 && (
        <section className={styles.section} aria-labelledby="movie-search-people">
          <h2 id="movie-search-people" className={styles.sectionTitle}>{dict.movies_search_people}</h2>
          <MoviePeopleList people={people} lang={lang} />
        </section>
      )}
      {data?.items.length ? (
        <section className={styles.section} aria-labelledby={people.length ? "movie-search-titles" : undefined}>
          {people.length > 0 && <h2 id="movie-search-titles" className={styles.sectionTitle}>{dict.movies_search_titles}</h2>}
          <MovieCards movies={data.items} lang={lang} />
          <Pagination currentPage={page} totalPages={data.totalPages} className={styles.pagination}
            labels={{ previous: dict.library_previous, next: dict.library_next, pageOf: dict.library_page_of }} />
        </section>
      ) : !people.length && <p className={styles.empty}>{query ? dict.movies_no_results : dict.movies_catalog_empty}</p>}
    </div>
  );
}
