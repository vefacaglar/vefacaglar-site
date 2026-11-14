import Link from "next/link";
import { getDictionary } from "../../../../../dictionaries";
import { notFound } from "next/navigation";
import LibraryMasthead from "../../../../../components/library/LibraryMasthead";
import MovieCards from "../../../../../components/movies/MovieCards";
import { getActiveLanguage } from "../../../../../lib/lang";
import { libraryMetadata } from "../../../../../lib/librarySeo";
import { localizeHref } from "../../../../../lib/localizeHref";
import { getMoviePerson, moviePersonHref, type MoviePersonPage } from "../../../../../lib/movies";
import { localizedAlternates } from "../../../../../lib/seo";
import styles from "./person.module.css";

type Props = {
  params: Promise<{ wikidataId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const [{ wikidataId }, lang] = await Promise.all([params, getActiveLanguage()]);
  const dict = getDictionary(lang);
  try {
    const data = await getMoviePerson(wikidataId);
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

export default async function MoviePerson({ params }: Props) {
  const [{ wikidataId }, lang] = await Promise.all([params, getActiveLanguage()]);
  const dict = getDictionary(lang);
  let data: MoviePersonPage | null;
  try {
    data = await getMoviePerson(wikidataId);
  } catch {
    return <div>
      <Link className={styles.back} href={localizeHref("/explore/movies", lang)}>← {dict.movies}</Link>
      <LibraryMasthead title={dict.movie_filmography} subtitle={dict.movie_films_in_catalog} />
      <p className={styles.empty} role="alert">{dict.movie_filmography_unavailable}</p>
      <a className="btnGhost" href={localizeHref(moviePersonHref(wikidataId), lang)}>{dict.movie_try_again}</a>
    </div>;
  }
  if (!data) notFound();
  return <div>
    <Link className={styles.back} href={localizeHref("/explore/movies", lang)}>← {dict.movies}</Link>
    <LibraryMasthead title={data.person.name} subtitle={dict.movie_filmography} />
    <p className={styles.summary}>{(data.total === 1 ? dict.movie_catalog_count_one : dict.movie_catalog_count_many).replace("{count}", data.total.toLocaleString(lang))}</p>
    {data.items.length ? <MovieCards movies={data.items} lang={lang} /> : <p className={styles.empty}>{dict.movie_person_empty}</p>}
    <p className={styles.source}>
      {dict.movie_person_source_before} <a href={`https://www.wikidata.org/wiki/${data.person.wikidataId}`}>Wikidata</a>. {dict.movie_person_source_after}
    </p>
  </div>;
}
