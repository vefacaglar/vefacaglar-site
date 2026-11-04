import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import styles from "./game.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { localizedAlternates } from "../../../lib/seo";
import { libraryMetadata } from "../../../lib/librarySeo";
import { getGame } from "../../../lib/data";
import { httpClient } from "../../../lib/httpClient";
import { getLoginHref } from "../../../lib/oidc";
import { formatDate } from "../../../lib/formatDate";
import GameLogs, { type GameLog } from "./GameLogs";
import { scoreTier } from "../scoreTier";

type Named = { name: string; slug: string };
type GameDetail = {
  slug: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  releaseDate: string | null;
  criticScore: number | null;
  criticScoreCount: number | null;
  hltbMainHours: number | null;
  hltbMainExtraHours: number | null;
  hltbCompletionistHours: number | null;
  developers: Named[];
  publishers: Named[];
  genres: Named[];
  themes: Named[];
  platforms: { id: string; name: string; slug: string }[];
};

interface GameProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(props: GameProps) {
  const params = await props.params;
  const lang = await getActiveLanguage();
  const game = (await getGame(params.slug)) as GameDetail | null;
  // Unknown game: the games layout's library metadata applies.
  if (!game) return {};
  return libraryMetadata({
    section: "games",
    title: game.title,
    description: game.description?.slice(0, 160) || getDictionary(lang).games_subtitle,
    // Games with a cover share it; the rest get the library preview card.
    image: game.coverImageUrl,
    alternates: localizedAlternates(`/games/${game.slug}`, lang),
  });
}

/** The signed-in user's logs, or null when nobody (valid) is signed in. */
async function getMyLogs(slug: string): Promise<GameLog[] | null> {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) return null;
  const res = await httpClient.get(`/api/games/${encodeURIComponent(slug)}/logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Game logs fetch failed: ${res.status}`);
  return ((await res.json()) as { items: GameLog[] }).items;
}

export default async function Game(props: GameProps) {
  const params = await props.params;
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  const game = (await getGame(params.slug)) as GameDetail | null;
  if (!game) notFound();

  const logs = await getMyLogs(game.slug);
  const loginHref = getLoginHref(localizeHref(`/games/${game.slug}`, lang));

  const names = (items: Named[]) => items.map((i) => i.name).join(", ");
  const year = game.releaseDate?.slice(0, 4) ?? null;
  const developers = names(game.developers);

  type Fact = { label: string; text?: string; tags?: string[] };
  const facts: Fact[] = (
    [
      { label: dict.released, text: game.releaseDate ? formatDate(game.releaseDate, lang) : "" },
      { label: dict.developers, text: developers },
      { label: dict.publishers, text: names(game.publishers) },
      { label: dict.genres, tags: game.genres.map((g) => g.name) },
      { label: dict.themes, tags: game.themes.map((t) => t.name) },
      { label: dict.platforms, tags: game.platforms.map((p) => p.name) },
    ] as Fact[]
  ).filter((fact) => fact.text || fact.tags?.length);

  const hltb: [string, number | null][] = [
    [dict.hltb_main, game.hltbMainHours],
    [dict.hltb_main_extra, game.hltbMainExtraHours],
    [dict.hltb_completionist, game.hltbCompletionistHours],
  ];
  const longest = Math.max(0, ...hltb.map(([, hours]) => hours ?? 0));
  const hasHltb = longest > 0;

  return (
    <article>
      <header className={game.coverImageUrl ? styles.hero : `${styles.hero} ${styles.heroNoCover}`}>
        {game.coverImageUrl && (
          <>
            <div className={styles.backdrop} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={game.coverImageUrl} alt="" />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.cover} src={game.coverImageUrl} alt="" />
          </>
        )}
        <div className={styles.heading}>
          <h1 className={styles.title}>{game.title}</h1>
          {(year || developers) && (
            <p className={styles.credits}>
              {year && <span className={styles.creditYear}>{year}</span>}
              {developers && <span>{developers}</span>}
            </p>
          )}
          {game.criticScore !== null && (
            <div className={styles.critic}>
              <span className={styles.criticScore} data-tier={scoreTier(game.criticScore)}>
                {game.criticScore}
              </span>
              <span className={styles.criticLabel}>
                <span>{dict.critic_score}</span>
                {game.criticScoreCount ? (
                  <span className={styles.criticCount}>
                    {dict.critic_reviews.replace("{count}", String(game.criticScoreCount))}
                  </span>
                ) : null}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className={styles.body}>
        {facts.length > 0 && (
          <aside className={styles.aside}>
            <dl className={styles.facts}>
              {facts.map((fact) => (
                <div key={fact.label} className={styles.fact}>
                  <dt>{fact.label}</dt>
                  {fact.tags ? (
                    <dd className={styles.tags}>
                      {fact.tags.map((tag) => (
                        <span key={tag} className={styles.tag}>
                          {tag}
                        </span>
                      ))}
                    </dd>
                  ) : (
                    <dd>{fact.text}</dd>
                  )}
                </div>
              ))}
            </dl>
          </aside>
        )}

        <div className={styles.main}>
          {game.description && <p className={styles.description}>{game.description}</p>}

          {hasHltb && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>{dict.how_long_to_beat}</h2>
              <ul className={styles.hltb}>
                {hltb.map(([label, hours]) => (
                  <li key={label} className={styles.hltbRow}>
                    <span className={styles.hoursLabel}>{label}</span>
                    {/* Bar length is relative to the longest of the three times. */}
                    <svg className={styles.bar} viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
                      <rect className={styles.barTrack} x="0" y="0" width="100" height="6" />
                      {hours !== null && (
                        <rect className={styles.barFill} x="0" y="0" width={(hours / longest) * 100} height="6" />
                      )}
                    </svg>
                    <span className={styles.hours}>{hours !== null ? `${hours}${dict.hours_short}` : "—"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{dict.my_logs}</h2>
            {logs === null ? (
              <Link href={loginHref} className="btnAccent">
                {dict.login_to_log}
              </Link>
            ) : (
              <>
                <GameLogs slug={game.slug} logs={logs} />
                <p className={styles.libraryLink}>
                  <Link href={localizeHref("/profile", lang)}>{dict.view_profile} →</Link>
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
