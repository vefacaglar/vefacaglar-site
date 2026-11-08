import Link from "next/link";
import type { MovieCard, MoviePersonRole } from "../../lib/movies";
import { localizeHref } from "../../lib/localizeHref";
import GenericPoster from "./GenericPoster";
import PosterCredit from "./PosterCredit";
import styles from "./movieCards.module.css";

const roleLabels: Record<MoviePersonRole, string> = { cast: "Cast", director: "Director", producer: "Producer" };

export default function MovieCards({ movies, lang }: {
  movies: (MovieCard & { roles?: MoviePersonRole[] })[];
  lang: string;
}) {
  return <ul className={styles.grid}>
    {movies.map((movie) => <li key={movie.slug}>
      <Link href={localizeHref(`/explore/movies/${movie.slug}`, lang)} className={styles.card}>
        <span className={styles.poster} aria-hidden="true">
          {movie.posterImageUrl && movie.posterAttribution ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={movie.posterImageUrl} alt="" loading="lazy" />
          ) : <GenericPoster title={movie.title} year={movie.releaseYear} />}
        </span>
        <span className={styles.caption}>
          <span className={styles.title}>{movie.title}</span>
          {movie.releaseYear !== null && <span className={styles.meta}>{movie.releaseYear}</span>}
          {movie.runtimeMinutes !== null && <span className={styles.meta}>{movie.runtimeMinutes} min</span>}
          {!!movie.roles?.length && <span className={styles.roles}>{movie.roles.map((role) => roleLabels[role]).join(" · ")}</span>}
        </span>
      </Link>
      {movie.posterImageUrl && movie.posterAttribution && <PosterCredit attribution={movie.posterAttribution} />}
    </li>)}
  </ul>;
}
