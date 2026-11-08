import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveLanguage } from "../../../../lib/lang";
import { localizeHref } from "../../../../lib/localizeHref";
import { formatDate } from "../../../../lib/formatDate";
import { decodeUsername, profilePath } from "../../../../lib/profileLibrary";
import { getMovieLibrary } from "../../../../lib/movieActivity";
import PrivateProfile from "../../components/PrivateProfile";
import GenericPoster from "../../../../components/movies/GenericPoster";
import PosterCredit from "../../../../components/movies/PosterCredit";
import styles from "./movies.module.css";
export default async function ProfileMovies({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params, handle = decodeUsername(username);
  const result = await getMovieLibrary(handle);
  if (result.kind === "not_found") notFound();
  const lang = await getActiveLanguage();
  if (result.kind === "private") return <PrivateProfile username={handle} path={profilePath(handle, "movies")} signedIn={result.signedIn} lang={lang} />;
  const { summary, movies, isOwner } = result.data;
  return <section>
    <dl className={styles.summary}>
      <div><dt>Films watched</dt><dd>{summary.watchedFilmCount}</dd></div>
      <div><dt>Watches</dt><dd>{summary.watchCount}</dd></div>
      <div><dt>Films rated</dt><dd>{summary.ratedFilmCount}</dd></div>
      <div><dt>Average rating</dt><dd>{summary.averageRating === null ? "—" : `${summary.averageRating}/10`}</dd></div>
    </dl>
    {movies.length === 0 ? <div className={styles.empty}><h2>No movies yet</h2><p>Watches and ratings will appear here.</p>{isOwner && <Link className="btnGhost" href={localizeHref("/explore/movies", lang)}>Browse movies</Link>}</div> :
      <ul className={styles.movies}>{movies.map((movie) => <li key={movie.slug} className={styles.movie}>
        <div className={styles.posterColumn}>
          <Link href={localizeHref(`/explore/movies/${movie.slug}`, lang)} className={styles.poster} aria-label={movie.title}>
            {movie.posterImageUrl && movie.posterAttribution ? <img src={movie.posterImageUrl} alt="" loading="lazy" /> : <GenericPoster title={movie.title} year={movie.releaseYear} />}
          </Link>
          {movie.posterImageUrl && movie.posterAttribution && <PosterCredit attribution={movie.posterAttribution} />}
        </div>
        <div className={styles.details}>
          <h2><Link href={localizeHref(`/explore/movies/${movie.slug}`, lang)}>{movie.title}</Link></h2>
          {movie.releaseYear !== null && <p className={styles.muted}>{movie.releaseYear}</p>}
          <p>{movie.rating === null ? "Not rated" : `${movie.rating}/10`} · {movie.watchCount} {movie.watchCount === 1 ? "watch" : "watches"}</p>
          {movie.watches.length > 0 && <details className={styles.history}><summary>Watch history</summary><ul>{movie.watches.map((watch, index) => <li key={watch.id ?? `${watch.watchedOn}-${index}`}>{watch.watchedOn ? <time dateTime={watch.watchedOn}>{formatDate(watch.watchedOn, "en")}</time> : "Date not specified"}</li>)}</ul></details>}
          {isOwner && <Link className={`btnGhost ${styles.manage}`} href={localizeHref(`/explore/movies/${movie.slug}#watch-history`, lang)}>Manage watches and rating</Link>}
        </div>
      </li>)}</ul>}
  </section>;
}
