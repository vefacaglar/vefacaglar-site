import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import styles from "./game.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary, formatMetaTitle } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { localizedAlternates } from "../../../lib/seo";
import { getGame } from "../../../lib/data";
import { httpClient } from "../../../lib/httpClient";
import { getAuthMode } from "../../../lib/oidc";
import GameLogs, { type GameLog } from "./GameLogs";

type Named = { name: string; slug: string };
type GameDetail = {
  slug: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  releaseDate: string | null;
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
  params: { slug: string };
}

export async function generateMetadata({ params }: GameProps) {
  const lang = getActiveLanguage();
  const game = (await getGame(params.slug)) as GameDetail | null;
  if (!game) return {};
  return {
    title: formatMetaTitle(game.title, lang),
    description: game.description?.slice(0, 160) ?? undefined,
    alternates: localizedAlternates(`/games/${game.slug}`, lang),
    openGraph: game.coverImageUrl ? { images: [{ url: game.coverImageUrl }] } : undefined,
  };
}

/** The signed-in user's logs, or null when nobody (valid) is signed in. */
async function getMyLogs(slug: string): Promise<GameLog[] | null> {
  const token = cookies().get("session_token")?.value;
  if (!token) return null;
  const res = await httpClient.get(`/api/games/${encodeURIComponent(slug)}/logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Game logs fetch failed: ${res.status}`);
  return ((await res.json()) as { items: GameLog[] }).items;
}

export default async function Game({ params }: GameProps) {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const game = (await getGame(params.slug)) as GameDetail | null;
  if (!game) notFound();

  const logs = await getMyLogs(game.slug);
  const returnTo = localizeHref(`/games/${game.slug}`, lang);
  const loginHref =
    getAuthMode() === "oidc" ? `/dashboard/login/oidc?returnTo=${encodeURIComponent(returnTo)}` : "/dashboard/login";

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  const names = (items: Named[]) => items.map((i) => i.name).join(", ");

  const facts: [string, string][] = (
    [
      [dict.released, game.releaseDate ? formatDate(game.releaseDate) : ""],
      [dict.developers, names(game.developers)],
      [dict.publishers, names(game.publishers)],
      [dict.genres, names(game.genres)],
      [dict.themes, names(game.themes)],
      [dict.platforms, names(game.platforms)],
    ] as [string, string][]
  ).filter(([, value]) => value);

  const hltb: [string, number | null][] = [
    [dict.hltb_main, game.hltbMainHours],
    [dict.hltb_main_extra, game.hltbMainExtraHours],
    [dict.hltb_completionist, game.hltbCompletionistHours],
  ];
  const hasHltb = hltb.some(([, hours]) => hours !== null);

  return (
    <article>
      <div className={styles.hero}>
        {game.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.cover} src={game.coverImageUrl} alt="" />
        )}
        <div className={styles.heading}>
          <h1>{game.title}</h1>
          <dl className={styles.facts}>
            {facts.map(([label, value]) => (
              <div key={label} className={styles.fact}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {game.description && <p className={styles.description}>{game.description}</p>}

      {hasHltb && (
        <section className={styles.section}>
          <h2>{dict.how_long_to_beat}</h2>
          <ul className={styles.hltb}>
            {hltb.map(([label, hours]) => (
              <li key={label}>
                <span className={styles.hours}>{hours !== null ? `${hours}${dict.hours_short}` : "—"}</span>
                <span className={styles.hoursLabel}>{label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2>{dict.my_logs}</h2>
        {logs === null ? (
          <Link href={loginHref} className="btnAccent">
            {dict.login_to_log}
          </Link>
        ) : (
          <GameLogs slug={game.slug} logs={logs} />
        )}
      </section>
    </article>
  );
}
