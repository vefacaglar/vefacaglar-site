import styles from "./movies.module.css";
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
  return libraryMetadata({
    section: "movies", title: "Movies", description: "Explore films, cast, and filmmakers.",
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
  const data = await getPublicMovies(page, query || undefined);
  return (
    <div>
      <LibraryMasthead title="Movies" subtitle="Explore films, cast, and filmmakers.">
        <CatalogSearch basePath="/explore/movies" initialQuery={query} placeholder="Search movies" maxLength={140} />
      </LibraryMasthead>
      {data?.items.length ? (
        <>
          <MovieCards movies={data.items} lang={lang} />
          <Pagination currentPage={page} totalPages={data.totalPages} className={styles.pagination}
            labels={{ previous: "Previous", next: "Next", pageOf: "Page {current} of {total}" }} />
        </>
      ) : <p className={styles.empty}>{query ? "No movies match your search." : "The movie catalog is being prepared. Check back soon."}</p>}
    </div>
  );
}
