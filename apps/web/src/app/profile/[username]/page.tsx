import { notFound } from "next/navigation";
import Link from "next/link";
import styles from "../profile.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { decodeUsername, getProfileLibrary, profilePath } from "../../../lib/profileLibrary";
import ProfileGameGrid from "../components/ProfileGameGrid";
import ProfileEmpty from "../components/ProfileEmpty";
import PrivateProfile from "../components/PrivateProfile";
import { sortShelf } from "../libraryShelf";

const RECENT_COUNT = 8;

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
  const dict = getDictionary(lang);
  const { summary, games, user, isOwner } = library;
  const name = user.displayName || user.username;

  const recent = sortShelf(games, "activity").slice(0, RECENT_COUNT);

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
          {games.length > recent.length && (
            <Link href={localizeHref(profilePath(user.username, "games"), lang)} className={styles.sectionLink}>
              {dict.see_all_games.replace("{count}", String(summary.gameCount))}
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <ProfileEmpty isOwner={isOwner} name={name} lang={lang} />
        ) : (
          <ProfileGameGrid games={recent} lang={lang} isOwner={isOwner} />
        )}
      </section>
    </>
  );
}
