import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { Fragment } from "react";
import styles from "./game.module.css";
import { getActiveLanguage } from "../../../../lib/lang";
import { getDictionary } from "../../../../dictionaries";
import { localizeHref } from "../../../../lib/localizeHref";
import { localizedAlternates } from "../../../../lib/seo";
import { libraryMetadata } from "../../../../lib/librarySeo";
import { getGame } from "../../../../lib/data";
import { httpClient } from "../../../../lib/httpClient";
import { getLoginHref } from "../../../../lib/oidc";
import { formatDate } from "../../../../lib/formatDate";
import GameLogs, { type GameLog } from "./GameLogs";
import { scoreTier } from "../scoreTier";
import { gameCompanyHref, type GameCompanyRole } from "../../../../lib/gameCompanies";

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
    alternates: localizedAlternates(`/explore/games/${game.slug}`, lang),
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
  const loginHref = getLoginHref(localizeHref(`/explore/games/${game.slug}`, lang));

  const companyLinks = (items: Named[], role: GameCompanyRole) => items.map((company, index) => (
    <Fragment key={company.slug}>
      {index > 0 && ", "}
      <Link href={localizeHref(gameCompanyHref(role, company.slug), lang)} className={styles.companyLink}>
        {company.name}
      </Link>
    </Fragment>
  ));
  const year = game.releaseDate?.slice(0, 4) ?? null;

  type Fact = { label: string; text?: string; tags?: string[]; companies?: Named[]; companyRole?: GameCompanyRole };
  const facts: Fact[] = (
    [
      { label: dict.released, text: game.releaseDate ? formatDate(game.releaseDate, lang) : "" },
      { label: dict.developers, companies: game.developers, companyRole: "developer" },
      { label: dict.publishers, companies: game.publishers, companyRole: "publisher" },
      { label: dict.genres, tags: game.genres.map((g) => g.name) },
      { label: dict.themes, tags: game.themes.map((t) => t.name) },
      { label: dict.platforms, tags: game.platforms.map((p) => p.name) },
    ] as Fact[]
  ).filter((fact) => fact.text || fact.tags?.length || fact.companies?.length);

  const hltb: [string, number | null][] = [
    [dict.hltb_main, game.hltbMainHours],
    [dict.hltb_main_extra, game.hltbMainExtraHours],
    [dict.hltb_completionist, game.hltbCompletionistHours],
  ];
  const longest = Math.max(0, ...hltb.map(([, hours]) => hours ?? 0));
  const hasHltb = longest > 0;

  return (
    <article>
      <header className={styles.hero}>
        {game.coverImageUrl && (
          <div className={styles.backdrop} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={game.coverImageUrl} alt="" />
          </div>
        )}
        <div className={game.coverImageUrl ? styles.heroInner : `${styles.heroInner} ${styles.heroNoCover}`}>
          {game.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.cover} src={game.coverImageUrl} alt="" />
          )}
          <div className={styles.heading}>
            <p className={styles.back}>
              <Link href={localizeHref("/explore/games", lang)}>← {dict.back_to_games}</Link>
            </p>
            <h1 className={styles.title}>{game.title}</h1>
            {game.developers.length > 0 && <p className={styles.byline}>{companyLinks(game.developers, "developer")}</p>}

            {(year || game.criticScore !== null) && (
              <dl className={styles.figures}>
                {year && (
                  <div className={styles.figure}>
                    <dt>{dict.released}</dt>
                    <dd className={styles.figureValue}>{year}</dd>
                  </div>
                )}
                {game.criticScore !== null && (
                  <div className={styles.figure} data-tier={scoreTier(game.criticScore)}>
                    <dt>{dict.critic_score}</dt>
                    <dd className={styles.figureValue}>
                      {game.criticScore}
                      <span className={styles.figureUnit}>/100</span>
                    </dd>
                    {game.criticScoreCount ? (
                      <dd className={styles.figureNote}>
                        {dict.critic_reviews.replace("{count}", String(game.criticScoreCount))}
                      </dd>
                    ) : null}
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>
      </header>

      <div className={styles.body}>
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
                    <svg className={styles.bar} viewBox="0 0 100 3" preserveAspectRatio="none" aria-hidden="true">
                      <rect className={styles.barTrack} x="0" y="0" width="100" height="3" />
                      {hours !== null && (
                        <rect className={styles.barFill} x="0" y="0" width={(hours / longest) * 100} height="3" />
                      )}
                    </svg>
                    <span className={styles.hours}>
                      {hours !== null ? (
                        <>
                          {hours}
                          <span className={styles.hoursUnit}>{dict.hours_short}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
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
                  <Link href={localizeHref("/profile", lang)}>{dict.view_profile}</Link>
                </p>
              </>
            )}
          </section>
        </div>

        {facts.length > 0 && (
          <aside className={styles.aside}>
            <h2 className={styles.asideTitle}>{dict.details}</h2>
            <dl className={styles.credits}>
              {facts.map((fact) => (
                <div key={fact.label} className={styles.credit}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.companies && fact.companyRole
                    ? companyLinks(fact.companies, fact.companyRole)
                    : fact.tags ? fact.tags.join(", ") : fact.text}</dd>
                </div>
              ))}
            </dl>
          </aside>
        )}
      </div>
    </article>
  );
}
