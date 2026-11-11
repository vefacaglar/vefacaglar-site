import Link from "next/link";
import { getDictionary } from "../../../../dictionaries";
import { notFound } from "next/navigation";
import { getActiveLanguage } from "../../../../lib/lang";
import { localizeHref } from "../../../../lib/localizeHref";
import { formatDate } from "../../../../lib/formatDate";
import { decodeUsername, profilePath } from "../../../../lib/profileLibrary";
import { getMovieLibrary } from "../../../../lib/movieActivity";
import PrivateProfile from "../../components/PrivateProfile";
import styles from "./movies.module.css";

export default async function ProfileMovies({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const handle = decodeUsername(username);
  const result = await getMovieLibrary(handle);
  if (result.kind === "not_found") notFound();

  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  if (result.kind === "private") {
    return <PrivateProfile username={handle} path={profilePath(handle, "movies")} signedIn={result.signedIn} lang={lang} />;
  }

  const { summary, movies, isOwner } = result.data;

  return (
    <section>
      <dl className={styles.summary}>
        <div className={styles.stat}>
          <dt>{dict.movie_films_watched}</dt>
          <dd>{summary.watchedFilmCount}</dd>
        </div>
        <div className={styles.stat}>
          <dt>{dict.movie_watches}</dt>
          <dd>{summary.watchCount}</dd>
        </div>
        <div className={styles.stat}>
          <dt>{dict.movie_films_rated}</dt>
          <dd>{summary.ratedFilmCount}</dd>
        </div>
        <div className={styles.stat}>
          <dt>{dict.movie_average_rating}</dt>
          <dd>
            {summary.averageRating === null ? (
              "—"
            ) : (
              <>
                {summary.averageRating}
                <span className={styles.unit}>/10</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      {movies.length === 0 ? (
        <div className={styles.empty}>
          <h2>{dict.movie_no_movies}</h2>
          <p>{dict.movie_library_hint}</p>
          {isOwner && (
            <Link className="btnGhost" href={localizeHref("/explore/movies", lang)}>
              {dict.movie_browse}
            </Link>
          )}
        </div>
      ) : (
        <ul className={styles.movies}>
          {movies.map((movie) => (
            <li key={movie.slug} className={styles.item}>
              <div className={styles.head}>
                <div className={styles.titleRow}>
                  <h2>
                    <Link href={localizeHref(`/explore/movies/${movie.slug}`, lang)}>{movie.title}</Link>
                  </h2>
                  {movie.releaseYear !== null && <span className={styles.year}>{movie.releaseYear}</span>}
                </div>
                <p className={styles.metrics}>
                  <span className={movie.rating !== null ? styles.rating : undefined}>
                    {movie.rating === null ? dict.movie_not_rated : `${movie.rating}/10`}
                  </span>
                  <span>
                    {movie.watchCount} {movie.watchCount === 1 ? dict.movie_watch_singular : dict.movie_watch_plural}
                  </span>
                </p>
              </div>

              {movie.watches.length > 0 && (
                <details className={styles.history}>
                  <summary>{dict.movie_watch_history}</summary>
                  <ul>
                    {movie.watches.map((watch, index) => (
                      <li key={watch.id ?? `${watch.watchedOn}-${index}`}>
                        {watch.watchedOn ? (
                          <time dateTime={watch.watchedOn}>{formatDate(watch.watchedOn, lang)}</time>
                        ) : (
                          dict.movie_date_unspecified
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {isOwner && (
                <div className={styles.actions}>
                  <Link
                    className="btnGhost"
                    href={localizeHref(`/explore/movies/${movie.slug}#watch-history`, lang)}
                  >
                    {dict.movie_manage}
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
