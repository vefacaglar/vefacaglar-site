import Link from "next/link";
import styles from "./games.module.css";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary, formatMetaTitle } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import { localizedAlternates } from "../../lib/seo";
import { getPublicGames } from "../../lib/data";
import Pagination from "../components/Pagination";
import GamesSearch from "./GamesSearch";

type GameCard = { slug: string; title: string; coverImageUrl: string | null; releaseDate: string | null };

export async function generateMetadata() {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  return {
    title: formatMetaTitle(dict.games, lang),
    description: dict.games_subtitle,
    alternates: localizedAlternates("/games", lang),
  };
}

interface GamesProps {
  searchParams: { page?: string; q?: string };
}

export default async function Games({ searchParams }: GamesProps) {
  const page = Math.max(1, Number(searchParams.page) || 1);
  const query = searchParams.q?.trim() || "";
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);

  const data = await getPublicGames(page, query || undefined);
  const games = (data?.items ?? []) as GameCard[];

  return (
    <div>
      <h1>{dict.games}</h1>
      <p className={styles.subtitle}>{dict.games_subtitle}</p>

      <GamesSearch initialQuery={query} />

      {games.length === 0 ? (
        <p className={styles.noResults}>{dict.no_games}</p>
      ) : (
        <>
          <ul className={styles.grid}>
            {games.map((game) => (
              <li key={game.slug}>
                <Link href={localizeHref(`/games/${game.slug}`, lang)} className={styles.card}>
                  <div className={styles.cover}>
                    {game.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={game.coverImageUrl} alt="" loading="lazy" />
                    ) : (
                      <span className={styles.coverFallback}>{game.title}</span>
                    )}
                  </div>
                  <span className={styles.title}>{game.title}</span>
                  {game.releaseDate && <span className={styles.year}>{game.releaseDate.slice(0, 4)}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <Pagination currentPage={page} totalPages={data?.totalPages ?? 0} />
        </>
      )}
    </div>
  );
}
