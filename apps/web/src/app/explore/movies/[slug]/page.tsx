import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { getMovie, moviePersonHref, type MovieCredit } from "../../../../lib/movies";
import { getActiveLanguage } from "../../../../lib/lang";
import { localizeHref } from "../../../../lib/localizeHref";
import { localizedAlternates } from "../../../../lib/seo";
import { libraryMetadata } from "../../../../lib/librarySeo";
import styles from "./movie.module.css";
import { getMyMovieActivity, type MovieActivity as Activity } from "../../../../lib/movieActivity";
import { getLoginHref } from "../../../../lib/oidc";
import { moviePageNumber } from "../../../../lib/movies";
import MovieActivity from "./MovieActivity";
import PosterCredit from "../../../../components/movies/PosterCredit";
import { communityPageNumber, getCommunity, type CommunityPage } from "../../../../lib/community";
import CommunitySection from "../../../../components/library/CommunitySection";
import { getSessionUser } from "../../../../lib/session";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ watchPage?: string; communityPage?: string; lang?: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const movie = await getMovie(slug);
  if (!movie) return {};
  return libraryMetadata({ section: "movies", title: movie.title,
    description: movie.description ?? "Film details, cast, and filmmakers.",
    alternates: localizedAlternates(`/explore/movies/${movie.slug}`, await getActiveLanguage()),
  });
}
export default async function Movie({ params, searchParams }: Props) {
  const { slug } = await params;
  const movie = await getMovie(slug);
  if (!movie) notFound();
  const lang = await getActiveLanguage();
  const query = await searchParams;
  const { watchPage } = query;
  const user = await getSessionUser();
  let community: CommunityPage | null = null;
  try { community = await getCommunity("movies", movie.slug, communityPageNumber(query.communityPage)); }
  catch (error) { unstable_rethrow(error); }
  let activity: Activity | null = null;
  let activityUnavailable = false;
  try {
    activity = await getMyMovieActivity(movie.slug, moviePageNumber(watchPage));
  } catch (error) {
    unstable_rethrow(error);
    activityUnavailable = true;
  }
  const sourceCredits = movie.credits.filter((credit) => credit.rank !== "deprecated");
  const credits = sourceCredits.filter((credit) => !!credit.name);
  const companies = movie.companies.filter((company) => !!company.name);
  const pendingCredits = sourceCredits.some((credit) => !credit.name) || companies.length !== movie.companies.length;
  const people = (role: MovieCredit["role"]) => credits.filter((credit) => credit.role === role);
  const sections: { title: string; items: MovieCredit[] }[] = [
    { title: "Directors", items: people("director") },
    { title: "Producers", items: people("producer") },
    { title: "Cast", items: people("cast") },
  ];
  return (
    <article className={styles.movie}>
      <div className={styles.hero}>
      {movie.posterImageUrl && movie.posterAttribution && <div className={styles.backdrop} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={movie.posterImageUrl} alt="" />
      </div>}
      <Link className={styles.back} href={localizeHref("/explore/movies", lang)}>← Movies</Link>
      <header className={styles.header}>
        <div>
          <span className={styles.poster} aria-hidden="true">
            {movie.posterImageUrl && movie.posterAttribution ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={movie.posterImageUrl} alt="" />
            ) : "Film"}
          </span>
          {movie.posterImageUrl && <PosterCredit attribution={movie.posterAttribution} />}
        </div>
        <div>
          <h1 className={styles.title}>{movie.title}</h1>
          <p className={styles.meta}>{[movie.releaseYear, movie.runtimeMinutes !== null ? `${movie.runtimeMinutes} min` : null].filter((value) => value !== null).join(" · ")}</p>
          {movie.originalTitle && movie.originalTitle !== movie.title && <p className={styles.original}>{movie.originalTitle}</p>}
          {movie.genres.length > 0 && <p className={styles.meta}>{movie.genres.map((genre) => genre.name).join(" · ")}</p>}
          {movie.description && <p className={styles.description}>{movie.description}</p>}
        </div>
      </header>
      </div>
      {activityUnavailable ? <section className={styles.section}>
        <h2>Your watches and rating</h2>
        <p className={styles.pending}>Your movie activity is temporarily unavailable.</p>
        <a className="btnGhost" href={localizeHref(`/explore/movies/${movie.slug}${watchPage ? `?watchPage=${moviePageNumber(watchPage)}` : ""}`, lang)}>Try again</a>
      </section> : activity ? <MovieActivity slug={movie.slug} activity={activity} isProfilePublic={user?.isProfilePublic ?? false} communityPage={query.communityPage} /> : <section className={styles.section}>
        <h2>Your watches and rating</h2>
        <Link className="btnAccent" href={getLoginHref(localizeHref(`/explore/movies/${movie.slug}`, lang))}>Sign in to log a watch or rate</Link>
      </section>}
      <CommunitySection data={community} path={`/explore/movies/${movie.slug}`} params={query} />
      {pendingCredits && <p className={styles.pending}>Additional credits are syncing.</p>}
      {sections.filter((section) => section.items.length > 0).map((section) => (
        <section className={styles.section} key={section.title}>
          <h2>{section.title}</h2>
          <ul className={styles.credits}>
            {section.items.map((person) => (
              <li key={person.statementId}>
                <Link href={localizeHref(moviePersonHref(person.wikidataId), lang)}>{person.name}</Link>
                {person.characterNames.length > 0 && <span className={styles.character}>{person.characterNames.join(", ")}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {companies.length > 0 && <section className={styles.section}>
        <h2>Production companies</h2>
        <ul className={styles.credits}>{companies.map((company) => (
          <li key={company.wikidataId}><a href={`https://www.wikidata.org/wiki/${company.wikidataId}`}>{company.name}</a></li>
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
