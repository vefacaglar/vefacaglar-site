import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import styles from "../../game.module.css";
import { getActiveLanguage } from "../../../../../../lib/lang";
import { getDictionary } from "../../../../../../dictionaries";
import { localizeHref } from "../../../../../../lib/localizeHref";
import { getGame } from "../../../../../../lib/data";
import { httpClient } from "../../../../../../lib/httpClient";
import { getLoginHref } from "../../../../../../lib/oidc";
import { libraryMetadata } from "../../../../../../lib/librarySeo";
import type { GameLog } from "../../GameLogs";
import LogEditForm, { type LogGameInfo } from "./LogEditForm";
import { getSessionUser } from "../../../../../../lib/session";

type LogDetail = {
  log: GameLog;
  game: { slug: string; title: string; coverImageUrl: string | null; platforms: { id: string; name: string }[] };
};

type CatalogGameDetail = {
  releaseDate?: string | null;
  criticScore?: number | null;
  hltbMainHours?: number | null;
  developers?: { name: string }[];
  genres?: { name: string }[];
};

interface LogPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export async function generateMetadata() {
  const lang = await getActiveLanguage();
  // A user's own log page is private; keep it out of search results.
  const dict = getDictionary(lang);
  return libraryMetadata({
    section: "games",
    title: dict.log_edit_title,
    description: dict.games_subtitle,
    robots: { index: false },
  });
}

export default async function GameLogPage(props: LogPageProps) {
  const params = await props.params;
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  const gameHref = localizeHref(`/explore/games/${params.slug}`, lang);

  const token = (await cookies()).get("session_token")?.value;
  const [res, catalogGame, user] = await Promise.all([
    token
      ? httpClient.get(`/api/games/logs/${encodeURIComponent(params.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      : Promise.resolve(null),
    getGame(params.slug) as Promise<CatalogGameDetail | null>,
    getSessionUser(),
  ]);

  // Signed out (or session expired): sign in and come back to this log.
  if (!res || res.status === 401) {
    const here = localizeHref(`/explore/games/${params.slug}/logs/${params.id}`, lang);
    redirect(getLoginHref(here));
  }
  if (res.status === 404 || res.status === 400) notFound();
  if (!res.ok) throw new Error(`Game log fetch failed: ${res.status}`);

  const { log, game } = (await res.json()) as LogDetail;
  if (game.slug !== params.slug) notFound();

  const gameInfo: LogGameInfo = {
    slug: game.slug,
    title: game.title,
    coverImageUrl: game.coverImageUrl,
    releaseYear: catalogGame?.releaseDate?.slice(0, 4) ?? null,
    developers: catalogGame?.developers?.map((d) => d.name).join(", ") || null,
    genres: catalogGame?.genres?.slice(0, 3).map((g) => g.name) ?? [],
    criticScore: typeof catalogGame?.criticScore === "number" ? catalogGame.criticScore : null,
    hltbMainHours: typeof catalogGame?.hltbMainHours === "number" ? catalogGame.hltbMainHours : null,
  };

  return (
    <article className={styles.logPage}>
      <p className={styles.backLink}>
        <Link href={gameHref}>← {game.title}</Link>
      </p>
      <h1 className={styles.logPageTitle}>{dict.log_edit_title}</h1>
      <LogEditForm slug={game.slug} log={log} platforms={game.platforms} gameInfo={gameInfo} isProfilePublic={user?.isProfilePublic ?? false} />
    </article>
  );
}
