import Link from "next/link";
import { getDictionary } from "../../../../../dictionaries";
import { notFound } from "next/navigation";
import LibraryMasthead from "../../../../../components/library/LibraryMasthead";
import MovieCards from "../../../../../components/movies/MovieCards";
import { getActiveLanguage } from "../../../../../lib/lang";
import { libraryMetadata } from "../../../../../lib/librarySeo";
import { localizeHref } from "../../../../../lib/localizeHref";
import { getMoviePerson, getMovieRankingNotice, moviePageNumber, moviePersonHref, type MoviePersonPage } from "../../../../../lib/movies";
import { localizedAlternates } from "../../../../../lib/seo";
import Pagination from "../../../../components/Pagination";
import styles from "./person.module.css";

type Props = {
  params: Promise<{ wikidataId: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const [{ wikidataId }, query, lang] = await Promise.all([params, searchParams, getActiveLanguage()]);
  const dict = getDictionary(lang);
  try {
    const data = await getMoviePerson(wikidataId, moviePageNumber(query.page));
    if (data) return libraryMetadata({
      section: "movies", title: `${data.person.name} · ${dict.movie_filmography}`,
      description: dict.movie_person_description.replace("{name}", data.person.name),
      alternates: localizedAlternates(moviePersonHref(data.person.wikidataId), lang),
    });
  } catch {
    // The page provides a retry state when the catalog cannot be reached.
  }
  return libraryMetadata({ section: "movies", title: dict.movie_filmography, description: dict.movie_filmography_description, robots: { index: false } });
}

export default async function MoviePerson({ params, searchParams }: Props) {
  const [{ wikidataId }, query, lang] = await Promise.all([params, searchParams, getActiveLanguage()]);
  const page = moviePageNumber(query.page);
  const dict = getDictionary(lang);
  let data: MoviePersonPage | null;
  try {
    data = await getMoviePerson(wikidataId, page);
  } catch {
    return <div>
      <Link className={styles.back} href={localizeHref("/explore/movies", lang)}>← {dict.movies}</Link>
      <LibraryMasthead title={dict.movie_filmography} subtitle={dict.movie_films_in_catalog} />
      <p className={styles.empty} role="alert">{dict.movie_filmography_unavailable}</p>
      <a className="btnGhost" href={localizeHref(`${moviePersonHref(wikidataId)}?page=${page}`, lang)}>{dict.movie_try_again}</a>
    </div>;
  }
  if (!data) notFound();
  const rankingNotice = getMovieRankingNotice(data.ranking, lang);
  return <div>
    <Link className={styles.back} href={localizeHref("/explore/movies", lang)}>← {dict.movies}</Link>
    <LibraryMasthead title={data.person.name} subtitle={dict.movie_filmography} />
    <p className={styles.summary}>{(data.total === 1 ? dict.movie_catalog_count_one : dict.movie_catalog_count_many).replace("{count}", data.total.toLocaleString(lang))}</p>
    {rankingNotice && <p className={styles.rankingNotice}>
      {dict.movie_wikipedia_interest} · {rankingNotice.date}. {dict.movie_alphabetical} <a href={rankingNotice.sourceUrl}>{dict.movie_source_label}</a>
    </p>}
    {data.items.length ? <MovieCards movies={data.items} lang={lang} /> : <div className={styles.empty}>
      <p>{data.total > 0 ? dict.movie_page_empty : dict.movie_person_empty}</p>
      {data.total > 0 && <Link className="btnGhost" href={localizeHref(moviePersonHref(data.person.wikidataId), lang)}>{dict.movie_first_page}</Link>}
    </div>}
    <Pagination currentPage={page} totalPages={data.totalPages} className={styles.pagination}
      labels={{ previous: dict.library_previous, next: dict.library_next, pageOf: dict.library_page_of }} />
    <p className={styles.source}>
      {dict.movie_person_source_before} <a href={`https://www.wikidata.org/wiki/${data.person.wikidataId}`}>Wikidata</a>. {dict.movie_person_source_after}
    </p>
  </div>;
}
