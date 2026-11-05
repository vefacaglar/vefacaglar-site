import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import styles from "../../game.module.css";
import { getActiveLanguage } from "../../../../../lib/lang";
import { getDictionary } from "../../../../../dictionaries";
import { localizeHref } from "../../../../../lib/localizeHref";
import { httpClient } from "../../../../../lib/httpClient";
import { getLoginHref } from "../../../../../lib/oidc";
import { libraryMetadata } from "../../../../../lib/librarySeo";
import type { GameLog } from "../../GameLogs";
import LogEditForm from "./LogEditForm";

type LogDetail = {
  log: GameLog;
  game: { slug: string; title: string; coverImageUrl: string | null; platforms: { id: string; name: string }[] };
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
  const gameHref = localizeHref(`/games/${params.slug}`, lang);

  const token = (await cookies()).get("session_token")?.value;
  const res = token
    ? await httpClient.get(`/api/games/logs/${encodeURIComponent(params.id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    : null;

  // Signed out (or session expired): sign in and come back to this log.
  if (!res || res.status === 401) {
    const here = localizeHref(`/games/${params.slug}/logs/${params.id}`, lang);
    redirect(getLoginHref(here));
  }
  if (res.status === 404 || res.status === 400) notFound();
  if (!res.ok) throw new Error(`Game log fetch failed: ${res.status}`);

  const { log, game } = (await res.json()) as LogDetail;
  if (game.slug !== params.slug) notFound();

  return (
    <article className={styles.narrow}>
      <p className={styles.backLink}>
        <Link href={gameHref}>← {game.title}</Link>
      </p>
      <header className={styles.logPageHeader}>
        {game.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.logPageCover} src={game.coverImageUrl} alt="" />
        )}
        <div className={styles.logPageHeading}>
          <p className={styles.logPageGame}>{game.title}</p>
          <h1>{dict.log_edit_title}</h1>
        </div>
      </header>
      <LogEditForm slug={game.slug} log={log} platforms={game.platforms} />
    </article>
  );
}
