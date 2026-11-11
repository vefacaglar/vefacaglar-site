import styles from "./movies.module.css";
import { getDictionary } from "../../../dictionaries";
import { getActiveLanguage } from "../../../lib/lang";
import { localizedAlternates } from "../../../lib/seo";
import { libraryMetadata } from "../../../lib/librarySeo";
import { getPublicMovies } from "../../../lib/movies";
import LibraryMasthead from "../../../components/library/LibraryMasthead";
import CatalogSearch from "../../../components/library/CatalogSearch";
import Pagination from "../../components/Pagination";
import MovieCards from "../../../components/movies/MovieCards";

export async function generateMetadata() {
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  return libraryMetadata({
    section: "movies", title: dict.movies, description: dict.movies_catalog_subtitle,
    alternates: localizedAlternates("/explore/movies", lang),
  });
}

export default async function Movies({ searchParams }: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const query = params.q?.trim() || "";
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  const data = await getPublicMovies(page, query || undefined);
  return (
    <div>
      <LibraryMasthead title={dict.movies} subtitle={dict.movies_catalog_subtitle}>
        <CatalogSearch basePath="/explore/movies" initialQuery={query} placeholder={dict.movies_search_placeholder} maxLength={140} />
      </LibraryMasthead>
      {data?.items.length ? (
        <>
          <MovieCards movies={data.items} lang={lang} />
          <Pagination currentPage={page} totalPages={data.totalPages} className={styles.pagination}
            labels={{ previous: dict.library_previous, next: dict.library_next, pageOf: dict.library_page_of }} />
        </>
      ) : <p className={styles.empty}>{query ? dict.movies_no_results : dict.movies_catalog_empty}</p>}
    </div>
  );
}
