import Link from "next/link";
import { getDictionary } from "../../dictionaries";
import type { MoviePersonRole, MoviePersonSummary } from "../../lib/movies";
import { localizeHref } from "../../lib/localizeHref";
import { moviePersonPath } from "../../lib/movieSearch";
import styles from "./movieCards.module.css";

/** Text-only people rows for catalog search results, styled like the film list. */
export default function MoviePeopleList({ people, lang }: { people: MoviePersonSummary[]; lang: string }) {
  const dict = getDictionary(lang);
  const roleLabels: Record<MoviePersonRole, string> = { cast: dict.movie_role_cast, director: dict.movie_role_director, producer: dict.movie_role_producer };
  return (
    <ul className={styles.grid}>
      {people.map((person) => (
        <li key={person.wikidataId} className={styles.item}>
          <Link href={localizeHref(moviePersonPath(person.wikidataId), lang)} className={styles.card}>
            <span className={styles.title}>{person.name}</span>
            <span className={styles.details}>
              <span className={styles.roles}>{roleLabels[person.role]}</span>
              {person.knownFor && <span className={styles.meta}>{person.knownFor.title}</span>}
              {person.knownFor?.releaseYear != null && <span className={styles.year}>{person.knownFor.releaseYear}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
