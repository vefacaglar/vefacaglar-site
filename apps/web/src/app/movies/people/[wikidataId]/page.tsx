import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryMasthead from "../../../../components/library/LibraryMasthead";
import MovieCards from "../../../../components/movies/MovieCards";
import { getActiveLanguage } from "../../../../lib/lang";
import { libraryMetadata } from "../../../../lib/librarySeo";
import { localizeHref } from "../../../../lib/localizeHref";
import { getMoviePerson, getMovieRankingNotice, moviePageNumber, moviePersonHref, type MoviePersonPage } from "../../../../lib/movies";
import { localizedAlternates } from "../../../../lib/seo";
import Pagination from "../../../components/Pagination";
import styles from "./person.module.css";

type Props = {
  params: Promise<{ wikidataId: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const [{ wikidataId }, query, lang] = await Promise.all([params, searchParams, getActiveLanguage()]);
  try {
    const data = await getMoviePerson(wikidataId, moviePageNumber(query.page));
    if (data) return libraryMetadata({
      section: "movies", title: `${data.person.name} · Filmography`,
      description: `Browse films in this catalog credited to ${data.person.name}.`,
      alternates: localizedAlternates(moviePersonHref(data.person.wikidataId), lang),
    });
  } catch {
    // The page provides a retry state when the catalog cannot be reached.
  }
  return libraryMetadata({ section: "movies", title: "Filmography", description: "Explore films and filmmakers in this catalog.", robots: { index: false } });
}

export default async function MoviePerson({ params, searchParams }: Props) {
  const [{ wikidataId }, query, lang] = await Promise.all([params, searchParams, getActiveLanguage()]);
  const page = moviePageNumber(query.page);
  let data: MoviePersonPage | null;
  try {
    data = await getMoviePerson(wikidataId, page);
  } catch {
    return <div>
      <Link className={styles.back} href={localizeHref("/movies", lang)}>← Movies</Link>
      <LibraryMasthead title="Filmography" subtitle="Films in this catalog" />
      <p className={styles.empty} role="alert">Filmography is temporarily unavailable. Please try again.</p>
      <a className="btnGhost" href={localizeHref(`${moviePersonHref(wikidataId)}?page=${page}`, lang)}>Try again</a>
    </div>;
  }
  if (!data) notFound();
  const rankingNotice = getMovieRankingNotice(data.ranking);
  return <div>
    <Link className={styles.back} href={localizeHref("/movies", lang)}>← Movies</Link>
    <LibraryMasthead title={data.person.name} subtitle="Filmography" />
    <p className={styles.summary}>{data.total.toLocaleString("en-US")} {data.total === 1 ? "movie" : "movies"} in this catalog</p>
    {rankingNotice && <p className={styles.rankingNotice}>
      Wikipedia interest · {rankingNotice.date}. Other films follow alphabetically. <a href={rankingNotice.sourceUrl}>Source</a>
    </p>}
    {data.items.length ? <MovieCards movies={data.items} lang={lang} /> : <div className={styles.empty}>
      <p>{data.total > 0 ? "No movies are available on this page." : "No movies are currently available for this person in this catalog."}</p>
      {data.total > 0 && <Link className="btnGhost" href={localizeHref(moviePersonHref(data.person.wikidataId), lang)}>View first page</Link>}
    </div>}
    <Pagination currentPage={page} totalPages={data.totalPages} className={styles.pagination}
      labels={{ previous: "Previous", next: "Next", pageOf: "Page {current} of {total}" }} />
    <p className={styles.source}>
      Person and credit data from <a href={`https://www.wikidata.org/wiki/${data.person.wikidataId}`}>Wikidata</a>. Filmography reflects the films currently available in this catalog and may be incomplete.
    </p>
  </div>;
}
