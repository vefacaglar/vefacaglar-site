import Link from "next/link";
import { getDictionary } from "../../dictionaries";
import type { MovieCard, MoviePersonRole } from "../../lib/movies";
import { localizeHref } from "../../lib/localizeHref";
import styles from "./movieCards.module.css";


export default function MovieCards({ movies, lang }: {
  movies: (MovieCard & { roles?: MoviePersonRole[] })[];
  lang: string;
}) {
  const dict = getDictionary(lang);
  const roleLabels: Record<MoviePersonRole, string> = { cast: dict.movie_role_cast, director: dict.movie_role_director, producer: dict.movie_role_producer };
  return (
    <ul className={styles.grid}>
      {movies.map((movie) => {
        const hasMeta =
          Boolean(movie.roles?.length) || movie.runtimeMinutes !== null || movie.releaseYear !== null;

        return (
          <li key={movie.slug} className={styles.item}>
            <Link href={localizeHref(`/explore/movies/${movie.slug}`, lang)} className={styles.card}>
              <span className={styles.title}>{movie.title}</span>
              {hasMeta && (
                <span className={styles.details}>
                  {!!movie.roles?.length && (
                    <span className={styles.roles}>{movie.roles.map((role) => roleLabels[role]).join(" · ")}</span>
                  )}
                  {movie.runtimeMinutes !== null && <span className={styles.meta}>{movie.runtimeMinutes} {dict.movie_minutes}</span>}
                  {movie.releaseYear !== null && <span className={styles.year}>{movie.releaseYear}</span>}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
