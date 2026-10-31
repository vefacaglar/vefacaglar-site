import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import styles from "./profile.module.css";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary, formatMetaTitle } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import { httpClient } from "../../lib/httpClient";
import { getAuthMode } from "../../lib/oidc";
import { getSessionUser } from "../../lib/session";
import type { GameLogInput } from "../games/actions";
import { statusLabel } from "../games/gameLogStatus";

type LibraryGame = {
  slug: string;
  title: string;
  coverImageUrl: string | null;
  status: GameLogInput["status"];
  rating: number | null;
  playtimeHours: number | null;
  logCount: number;
  lastLoggedAt: string;
};

type Library = {
  summary: {
    gameCount: number;
    logCount: number;
    completedCount: number;
    playtimeHours: number;
    averageRating: number | null;
  };
  games: LibraryGame[];
};

export async function generateMetadata() {
  const lang = getActiveLanguage();
  // A user's own library is private; keep it out of search results.
  return { title: formatMetaTitle(getDictionary(lang).profile, lang), robots: { index: false } };
}

export default async function ProfilePage() {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  const token = cookies().get("session_token")?.value;
  const res = token
    ? await httpClient.get("/api/games/me/library", {
        headers: { Authorization: `Bearer ${token}` },
      })
    : null;

  // Signed out (or session expired): sign in and come back to this page.
  if (!res || res.status === 401) {
    const here = localizeHref("/profile", lang);
    redirect(getAuthMode() === "oidc" ? `/dashboard/login/oidc?returnTo=${encodeURIComponent(here)}` : "/dashboard/login");
  }
  if (!res.ok) throw new Error(`Games library fetch failed: ${res.status}`);

  const { summary, games } = (await res.json()) as Library;
  const user = await getSessionUser();

  const stats: [string, string][] = [
    [String(summary.gameCount), dict.stat_games],
    [String(summary.completedCount), dict.stat_completed],
    [String(summary.logCount), dict.stat_logs],
    [`${summary.playtimeHours}${dict.hours_short}`, dict.stat_hours],
    [summary.averageRating !== null ? `${summary.averageRating}/100` : "—", dict.stat_avg_rating],
  ];

  return (
    <article>
      <h1>{user?.displayName || dict.profile}</h1>

      <ul className={styles.stats}>
        {stats.map(([value, label]) => (
          <li key={label}>
            <span className={styles.statValue}>{value}</span>
            <span className={styles.statLabel}>{label}</span>
          </li>
        ))}
      </ul>

      <section className={styles.section}>
        <h2>{dict.my_games}</h2>
        {games.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.muted}>{dict.no_library}</p>
            <Link href={localizeHref("/games", lang)} className="btnAccent">
              {dict.browse_games}
            </Link>
          </div>
        ) : (
          <ul className={styles.library}>
            {games.map((game) => (
              <li key={game.slug} className={styles.gameRow}>
                {game.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.thumb} src={game.coverImageUrl} alt="" loading="lazy" />
                ) : (
                  <span className={styles.thumb} aria-hidden="true" />
                )}
                <div className={styles.gameInfo}>
                  <Link href={localizeHref(`/games/${game.slug}`, lang)} className={styles.gameTitle}>
                    {game.title}
                  </Link>
                  <p className={styles.gameMeta}>
                    <span className={styles.status}>{statusLabel(dict, game.status)}</span>
                    {game.rating !== null && <span>{game.rating}/100</span>}
                    {game.playtimeHours !== null && <span>{`${game.playtimeHours}${dict.hours_short}`}</span>}
                    {game.logCount > 1 && (
                      <span>{dict.log_count.replace("{count}", String(game.logCount))}</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
