import { notFound } from "next/navigation";
import Link from "next/link";
import styles from "../profile.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import {
  decodeUsername,
  getProfileLibrary,
  profilePath,
  type LibraryActivityItem,
} from "../../../lib/profileLibrary";
import ProfileEmpty from "../components/ProfileEmpty";
import PrivateProfile from "../components/PrivateProfile";
import { sortShelf } from "../libraryShelf";
import { activityStatusLabel } from "../../explore/games/gameLogStatus";
import PosterCredit from "../../../components/movies/PosterCredit";
import { getProfileMovieLibrary } from "../movieLibrary";

const RECENT_COUNT = 12;

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10.5 2.5 13.5 5.5 5.5 13.5H2.5V10.5L10.5 2.5Z" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8.5 4.5 11.5 7.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

interface OverviewProps {
  params: Promise<{ username: string }>;
}

type Stat = {
  label: string;
  value: string;
  unit?: string;
  /** 0–1 share drawn as a bar under the value. */
  share?: number;
};

export default async function ProfileOverview(props: OverviewProps) {
  const { username } = await props.params;
  const handle = decodeUsername(username);
  const result = await getProfileLibrary(handle);
  if (result.kind === "not_found") notFound();

  const lang = await getActiveLanguage();
  if (result.kind === "private") {
    return <PrivateProfile username={handle} path={profilePath(handle)} signedIn={result.signedIn} lang={lang} />;
  }

  const library = result.data;
  const movieLibrary = await getProfileMovieLibrary(handle);
  const dict = getDictionary(lang);
  const { summary, games, recentActivity, user, isOwner } = library;
  const name = user.displayName || user.username;

  const fallbackActivity: LibraryActivityItem[] = sortShelf(games, "activity").map((g) => ({
    slug: g.slug,
    title: g.title,
    coverImageUrl: g.coverImageUrl,
    status: g.status,
    playtimeHours: g.playtimeHours,
    activityAt: g.lastActivityAt || g.lastLoggedAt,
    logId: g.latestLogId,
  }));
  const recent = (recentActivity && recentActivity.length > 0 ? recentActivity : fallbackActivity).slice(
    0,
    RECENT_COUNT
  );

  const stats: Stat[] = [
    { label: dict.stat_games, value: String(summary.gameCount) },
    {
      label: dict.stat_completed,
      value: String(summary.completedCount),
      unit: summary.gameCount > 0 ? `/${summary.gameCount}` : undefined,
      share: summary.gameCount > 0 ? summary.completedCount / summary.gameCount : undefined,
    },
    { label: dict.stat_hours, value: String(summary.playtimeHours), unit: dict.hours_short },
    {
      label: dict.stat_avg_rating,
      value: summary.averageRating !== null ? String(summary.averageRating) : "—",
      unit: summary.averageRating !== null ? "/100" : undefined,
      share: summary.averageRating !== null ? summary.averageRating / 100 : undefined,
    },
  ];

  return (
    <>
      <dl className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.stat}>
            <dt className={styles.statLabel}>{stat.label}</dt>
            <dd className={styles.statValue}>
              {stat.value}
              {stat.unit && <span className={styles.statUnit}>{stat.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{dict.recent_activity}</h2>
          {summary.gameCount > 0 && (
            <Link href={localizeHref(profilePath(user.username, "games"), lang)} className={styles.sectionLink}>
              {dict.see_all_games.replace("{count}", String(summary.gameCount))}
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <ProfileEmpty isOwner={isOwner} name={name} lang={lang} />
        ) : (
          <ul className={styles.activityList}>
            {recent.map((item, idx) => {
              const href = localizeHref(`/explore/games/${item.slug}`, lang);
              const editHref =
                isOwner && item.logId
                  ? localizeHref(`/explore/games/${item.slug}/logs/${encodeURIComponent(item.logId)}`, lang)
                  : null;
              return (
                <li
                  key={`${item.slug}-${item.activityAt}-${idx}`}
                  className={styles.activityItem}
                  data-status={item.status}
                >
                  <div className={styles.activityMain}>
                    <span className={styles.activityMarker} aria-hidden="true" />
                    <Link href={href} className={styles.activityThumb} tabIndex={-1} aria-hidden="true">
                      {item.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.coverImageUrl} alt="" loading="lazy" />
                      ) : (
                        <span className={styles.activityThumbFallback}>{item.title.slice(0, 1)}</span>
                      )}
                    </Link>
                    <Link href={href} className={styles.activityTitle}>
                      {item.title}
                    </Link>
                  </div>
                  <div className={styles.activityMeta}>
                    {item.playtimeHours !== null && item.playtimeHours > 0 && (
                      <span className={styles.activityHours}>
                        {item.playtimeHours}
                        <span className={styles.activityUnit}>{dict.hours_short}</span>
                      </span>
                    )}
                    <span className={styles.activityStatus}>{activityStatusLabel(dict, item.status)}</span>
                    {editHref && (
                      <Link
                        href={editHref}
                        className={styles.activityEdit}
                        aria-label={dict.list_edit_log_for.replace("{title}", item.title)}
                        title={dict.log_edit_title}
                      >
                        <PencilIcon />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Movies</h2>
          {movieLibrary && movieLibrary.summary.filmCount > 0 && (
            <Link href={localizeHref(profilePath(user.username, "movies"), lang)} className={styles.sectionLink}>
              View all movies
            </Link>
          )}
        </div>
        {!movieLibrary ? (
          <p className={styles.muted}>Movie library is temporarily unavailable.</p>
        ) : (
          <>
            <dl className={styles.stats}>
              <div className={styles.stat}><dt className={styles.statLabel}>Movies</dt><dd className={styles.statValue}>{movieLibrary.summary.filmCount}</dd></div>
              <div className={styles.stat}><dt className={styles.statLabel}>Films watched</dt><dd className={styles.statValue}>{movieLibrary.summary.watchedFilmCount}</dd></div>
              <div className={styles.stat}><dt className={styles.statLabel}>Watches</dt><dd className={styles.statValue}>{movieLibrary.summary.watchCount}</dd></div>
              <div className={styles.stat}><dt className={styles.statLabel}>Average rating</dt><dd className={styles.statValue}>{movieLibrary.summary.averageRating ?? "—"}{movieLibrary.summary.averageRating !== null && <span className={styles.statUnit}>/10</span>}</dd></div>
            </dl>
            {movieLibrary.movies.length === 0 ? (
              <p className={styles.muted}>Watches and ratings will appear here.</p>
            ) : (
              <ul className={styles.movieShelf}>
                {movieLibrary.movies.slice(0, 6).map((movie) => (
                  <li key={movie.slug} className={styles.movieShelfItem}>
                    <Link href={localizeHref(`/explore/movies/${movie.slug}`, lang)} className={styles.movieShelfPoster} aria-label={movie.title}>
                      {movie.posterImageUrl && movie.posterAttribution ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={movie.posterImageUrl} alt="" loading="lazy" />
                      ) : <span>Film</span>}
                    </Link>
                    {movie.posterImageUrl && movie.posterAttribution && <PosterCredit attribution={movie.posterAttribution} />}
                    <Link href={localizeHref(`/explore/movies/${movie.slug}`, lang)} className={styles.activityTitle}>{movie.title}</Link>
                    <p className={styles.movieShelfMeta}>
                      {movie.rating === null ? "Not rated" : `${movie.rating}/10`} · {movie.watchCount} {movie.watchCount === 1 ? "watch" : "watches"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </>
  );
}
