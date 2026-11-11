import Link from "next/link";
import { formatReviewScore, selectReviewScores } from "../../app/explore/games/cardMetrics";
import { scoreTier } from "../../app/explore/games/scoreTier";
import { localizeHref } from "../../lib/localizeHref";
import type { MovieCard } from "../../lib/movies";
import styles from "./ExploreGrid.module.css";

export interface ExploreGame {
  slug: string;
  title: string;
  releaseDate: string | null;
  metacriticScore?: number | null;
  openCriticScore?: number | null;
  criticScore?: number | null;
}

export default function ExploreGrid({ games, movies, lang, emptyMessage }: {
  games: ExploreGame[];
  movies: MovieCard[];
  lang: string;
  emptyMessage: string;
}) {
  const items = [
    ...games.map((item) => ({ type: "game" as const, item })),
    ...movies.map((item) => ({ type: "movie" as const, item })),
  ];

  if (items.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  const showKind = games.length > 0 && movies.length > 0;

  return (
    <ul className={styles.grid}>
      {items.map(({ type, item }) => {
        const isGame = type === "game";
        const year = isGame ? item.releaseDate?.slice(0, 4) ?? null : item.releaseYear;
        const topScore = isGame ? selectReviewScores(item)[0] : undefined;
        const runtime = !isGame && item.runtimeMinutes !== null ? `${item.runtimeMinutes} min` : null;
        const hasMeta =
          showKind || Boolean(topScore) || Boolean(runtime) || (year !== null && year !== "");

        return (
          <li key={`${type}:${item.slug}`} className={styles.item}>
            <Link
              href={localizeHref(`/explore/${isGame ? "games" : "movies"}/${encodeURIComponent(item.slug)}`, lang)}
              className={styles.card}
            >
              <span className={styles.title}>{item.title}</span>
              {hasMeta && (
                <span className={styles.metaGroup}>
                  {showKind && <span className={styles.kind}>{isGame ? "Game" : "Film"}</span>}
                  {topScore && (
                    <span className={styles.rating}>
                      <span className={styles.meta}>{topScore.source}</span>
                      <span className={styles.ratingValue} data-tier={scoreTier(topScore.value)}>
                        {formatReviewScore(topScore.value, lang)}/100
                      </span>
                    </span>
                  )}
                  {runtime && <span className={styles.meta}>{runtime}</span>}
                  {year !== null && year !== "" && <span className={styles.year}>{year}</span>}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
