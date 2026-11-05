import Link from "next/link";
import { notFound } from "next/navigation";
import { getMovie, type MovieCredit } from "../../../lib/movies";
import { getActiveLanguage } from "../../../lib/lang";
import { localizeHref } from "../../../lib/localizeHref";
import { localizedAlternates } from "../../../lib/seo";
import { libraryMetadata } from "../../../lib/librarySeo";
import styles from "./movie.module.css";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const movie = await getMovie(slug);
  if (!movie) return {};
  return libraryMetadata({ section: "movies", title: movie.title,
    description: movie.description ?? "Film details, cast, and filmmakers.",
    alternates: localizedAlternates(`/movies/${movie.slug}`, await getActiveLanguage()),
  });
}
export default async function Movie({ params }: Props) {
  const { slug } = await params;
  const movie = await getMovie(slug);
  if (!movie) notFound();
  const lang = await getActiveLanguage();
  const credits = movie.credits.filter((credit) => credit.rank !== "deprecated");
  const people = (role: MovieCredit["role"]) => credits.filter((credit) => credit.role === role);
  const sections: { title: string; items: MovieCredit[] }[] = [
    { title: "Directors", items: people("director") },
    { title: "Producers", items: people("producer") },
    { title: "Cast", items: people("cast") },
  ];
  return (
    <article className={styles.movie}>
      <Link className={styles.back} href={localizeHref("/movies", lang)}>← Movies</Link>
      <header className={styles.header}>
        <span className={styles.poster} aria-hidden="true">Film</span>
        <div>
          <h1 className={styles.title}>{movie.title}</h1>
          <p className={styles.meta}>{[movie.releaseYear, movie.runtimeMinutes !== null ? `${movie.runtimeMinutes} min` : null].filter((value) => value !== null).join(" · ")}</p>
          {movie.originalTitle && movie.originalTitle !== movie.title && <p className={styles.original}>{movie.originalTitle}</p>}
          {movie.genres.length > 0 && <p className={styles.meta}>{movie.genres.map((genre) => genre.name).join(" · ")}</p>}
          {movie.description && <p className={styles.description}>{movie.description}</p>}
        </div>
      </header>
      {sections.filter((section) => section.items.length > 0).map((section) => (
        <section className={styles.section} key={section.title}>
          <h2>{section.title}</h2>
          <ul className={styles.credits}>
            {section.items.map((person) => (
              <li key={person.statementId}>
                <a href={`https://www.wikidata.org/wiki/${person.wikidataId}`}>{person.name ?? person.wikidataId}</a>
                {person.characterNames.length > 0 && <span className={styles.character}>{person.characterNames.join(", ")}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {movie.companies.length > 0 && <section className={styles.section}>
        <h2>Production companies</h2>
        <ul className={styles.credits}>{movie.companies.map((company) => (
          <li key={company.wikidataId}><a href={`https://www.wikidata.org/wiki/${company.wikidataId}`}>{company.name ?? company.wikidataId}</a></li>
        ))}</ul>
      </section>}
      <footer className={styles.source}>
        <a href={`https://www.wikidata.org/wiki/${movie.wikidataId}`}>Source: Wikidata</a>
        {movie.imdbId && <a href={`https://www.imdb.com/title/${movie.imdbId}/`}>IMDb</a>}
        <p>Credits reflect the available source data and may be incomplete.</p>
      </footer>
    </article>
  );
}
