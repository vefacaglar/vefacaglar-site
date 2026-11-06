import Link from "next/link";
import styles from "./movies.module.css";
import { getActiveLanguage } from "../../lib/lang";
import { localizeHref } from "../../lib/localizeHref";
import { localizedAlternates } from "../../lib/seo";
import { libraryMetadata } from "../../lib/librarySeo";
import { getMovieRankingNotice, getPublicMovies } from "../../lib/movies";
import LibraryMasthead from "../../components/library/LibraryMasthead";
import Pagination from "../components/Pagination";

export async function generateMetadata() {
  const lang = await getActiveLanguage();
  return libraryMetadata({
    section: "movies", title: "Movies", description: "Explore films, cast, and filmmakers.",
    alternates: localizedAlternates("/movies", lang),
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
  const rankingNotice = getMovieRankingNotice(data?.ranking);
  return (
    <div>
      <LibraryMasthead title="Movies" subtitle="Explore films, cast, and filmmakers.">
        <form className={styles.search} action={localizeHref("/movies", lang)} role="search">
          {lang !== "en" && <input type="hidden" name="lang" value={lang} />}
          <input className={styles.searchInput} type="search" name="q" defaultValue={query}
            placeholder="Search movies" aria-label="Search movies" maxLength={140} />
          <button className="btnGhost" type="submit">Search</button>
        </form>
      </LibraryMasthead>
      {rankingNotice && <p className={styles.rankingNotice}>
        Wikipedia interest · {rankingNotice.date}. Films appearing among the most-viewed English Wikipedia articles. Other films follow alphabetically. <a href={rankingNotice.sourceUrl}>Source</a>
      </p>}
      {data?.items.length ? (
        <>
          <p className={styles.summary}>{data.total.toLocaleString("en-US")} {data.total === 1 ? "movie" : "movies"}</p>
          <ul className={styles.grid}>
            {data.items.map((movie) => (
              <li key={movie.slug}>
                <Link href={localizeHref(`/movies/${movie.slug}`, lang)} className={styles.card}>
                  <span className={styles.poster} aria-hidden="true">
                    {movie.posterImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={movie.posterImageUrl} alt="" loading="lazy" />
                    ) : <span className={styles.posterMark}>Film</span>}
                  </span>
                  <span className={styles.caption}>
                    <span className={styles.title}>{movie.title}</span>
                    {movie.releaseYear !== null && <span className={styles.meta}>{movie.releaseYear}</span>}
                    {movie.runtimeMinutes !== null && <span className={styles.meta}>{movie.runtimeMinutes} min</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination currentPage={page} totalPages={data.totalPages} className={styles.pagination}
            labels={{ previous: "Previous", next: "Next", pageOf: "Page {current} of {total}" }} />
        </>
      ) : <p className={styles.empty}>{query ? "No movies match your search." : "The movie catalog is being prepared. Check back soon."}</p>}
      <p className={styles.source}>Film data from <a href="https://www.wikidata.org/">Wikidata</a>. Coverage varies as the catalog grows.</p>
    </div>
  );
}
