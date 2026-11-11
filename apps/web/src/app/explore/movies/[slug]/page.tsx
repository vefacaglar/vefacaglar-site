import { getDictionary } from "../../../../dictionaries";
import { Fragment } from "react";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { getMovie, moviePageNumber, moviePersonHref, type MovieCredit } from "../../../../lib/movies";
import { getActiveLanguage } from "../../../../lib/lang";
import { localizeHref } from "../../../../lib/localizeHref";
import { localizedAlternates } from "../../../../lib/seo";
import { libraryMetadata } from "../../../../lib/librarySeo";
import styles from "./movie.module.css";
import { getMyMovieActivity, type MovieActivity as Activity } from "../../../../lib/movieActivity";
import { getLoginHref } from "../../../../lib/oidc";
import MovieActivity from "./MovieActivity";
import { communityPageNumber, getCommunity, type CommunityPage } from "../../../../lib/community";
import CommunitySection from "../../../../components/library/CommunitySection";
import { getSessionUser } from "../../../../lib/session";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ watchPage?: string; communityPage?: string; lang?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const movie = await getMovie(slug);
  if (!movie) return {};
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  return libraryMetadata({
    section: "movies",
    title: movie.title,
    description: movie.description ?? dict.movie_detail_description,
    alternates: localizedAlternates(`/explore/movies/${movie.slug}`, lang),
  });
}

export default async function Movie({ params, searchParams }: Props) {
  const { slug } = await params;
  const movie = await getMovie(slug);
  if (!movie) notFound();
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  const query = await searchParams;
  const { watchPage } = query;
  const user = await getSessionUser();

  let community: CommunityPage | null = null;
  try {
    community = await getCommunity("movies", movie.slug, communityPageNumber(query.communityPage));
  } catch (error) {
    unstable_rethrow(error);
  }

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
  const directors = people("director");
  const sections: { title: string; items: MovieCredit[] }[] = [
    { title: dict.movie_directors, items: directors },
    { title: dict.movie_producers, items: people("producer") },
    { title: dict.movie_cast, items: people("cast") },
  ];

  const hasFigures =
    movie.releaseYear !== null ||
    movie.runtimeMinutes !== null ||
    Boolean(community && community.rating.average !== null);

  return (
    <article className={styles.movie}>
      <header className={styles.header}>
        <p className={styles.back}>
          <Link href={localizeHref("/explore/movies", lang)}>← {dict.movies}</Link>
        </p>
        <h1 className={styles.title}>{movie.title}</h1>
        {movie.originalTitle && movie.originalTitle !== movie.title && (
          <p className={styles.original}>{movie.originalTitle}</p>
        )}
        {directors.length > 0 && (
          <p className={styles.byline}>
            {dict.movie_directed_by}{" "}
            {directors.map((director, index) => (
              <Fragment key={director.statementId}>
                {index > 0 && ", "}
                <Link
                  href={localizeHref(moviePersonHref(director.wikidataId), lang)}
                  className={styles.personLink}
                >
                  {director.name}
                </Link>
              </Fragment>
            ))}
          </p>
        )}
        {movie.genres.length > 0 && (
          <p className={styles.genres}>{movie.genres.map((genre) => genre.name).join(" · ")}</p>
        )}

        {hasFigures && (
          <dl className={styles.figures}>
            {movie.releaseYear !== null && (
              <div className={styles.figure}>
                <dt>{dict.movie_released}</dt>
                <dd className={styles.figureValue}>{movie.releaseYear}</dd>
              </div>
            )}
            {movie.runtimeMinutes !== null && (
              <div className={styles.figure}>
                <dt>{dict.movie_runtime}</dt>
                <dd className={styles.figureValue}>
                  {movie.runtimeMinutes}
                  <span className={styles.figureUnit}>{dict.movie_minutes}</span>
                </dd>
              </div>
            )}
            {community && community.rating.average !== null && (
              <div className={styles.figure}>
                <dt>{dict.movie_site_rating}</dt>
                <dd className={`${styles.figureValue} ${styles.figureAccent}`}>
                  {community.rating.average.toFixed(1)}
                  <span className={styles.figureUnit}>/{community.rating.scale}</span>
                </dd>
              </div>
            )}
          </dl>
        )}
      </header>

      {movie.description && <p className={styles.description}>{movie.description}</p>}

      {activityUnavailable ? (
        <section className={styles.leadSection}>
          <h2>{dict.movie_watches_rating}</h2>
          <p className={styles.pending}>{dict.movie_activity_unavailable}</p>
          <a
            className="btnGhost"
            href={localizeHref(
              `/explore/movies/${movie.slug}${watchPage ? `?watchPage=${moviePageNumber(watchPage)}` : ""}`,
              lang,
            )}
          >
            {dict.movie_try_again}
          </a>
        </section>
      ) : activity ? (
        <MovieActivity
          slug={movie.slug}
          activity={activity}
          userId={user?.id ?? null}
          isProfilePublic={user?.isProfilePublic ?? false}
          communityPage={query.communityPage}
        />
      ) : (
        <section className={styles.leadSection}>
          <h2>{dict.movie_watches_rating}</h2>
          <Link className="btnAccent" href={getLoginHref(localizeHref(`/explore/movies/${movie.slug}`, lang))}>
            {dict.movie_sign_in_log}
          </Link>
        </section>
      )}

      <CommunitySection data={community} path={`/explore/movies/${movie.slug}`} params={query} lang={lang} />

      {pendingCredits && <p className={styles.pending}>{dict.movie_credits_syncing}</p>}

      {sections
        .filter((section) => section.items.length > 0)
        .map((section) => (
          <section className={styles.section} key={section.title}>
            <h2>{section.title}</h2>
            <ul className={styles.credits}>
              {section.items.map((person) => (
                <li key={person.statementId}>
                  <Link href={localizeHref(moviePersonHref(person.wikidataId), lang)}>{person.name}</Link>
                  {person.characterNames.length > 0 && (
                    <span className={styles.character}>{person.characterNames.join(", ")}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

      {companies.length > 0 && (
        <section className={styles.section}>
          <h2>{dict.movie_companies}</h2>
          <ul className={styles.credits}>
            {companies.map((company) => (
              <li key={company.wikidataId}>
                <a href={`https://www.wikidata.org/wiki/${company.wikidataId}`}>{company.name}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className={styles.source}>
        <a href={`https://www.wikidata.org/wiki/${movie.wikidataId}`}>{dict.movie_source}</a>
        {movie.imdbId && <a href={`https://www.imdb.com/title/${movie.imdbId}/`}>IMDb</a>}
        <p>{dict.movie_credits_note}</p>
      </footer>
    </article>
  );
}
