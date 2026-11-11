import Link from "next/link";
import { localizeHref } from "../../../lib/localizeHref";
import { formatHltbHours, formatReviewScore, selectReviewScores } from "./cardMetrics";
import { scoreTier } from "./scoreTier";
import styles from "./GameGrid.module.css";

export type GameCardItem = {
  slug: string;
  title: string;
  coverImageUrl?: string | null;
  releaseDate: string | null;
  // Optional while an older API deployment does not expose the provider fields.
  metacriticScore?: number | null;
  openCriticScore?: number | null;
  criticScore?: number | null;
  hltbMainHours?: string | null;
  hltbMainExtraHours?: string | null;
  hltbCompletionistHours?: string | null;
};

export default function GameGrid({ games, lang }: { games: GameCardItem[]; lang: string }) {
  return (
    <ul className={styles.grid}>
      {games.map((game) => {
        const year = game.releaseDate?.slice(0, 4) ?? null;
        const reviews = selectReviewScores(game);
        const durations = [
          { label: "Main", hours: formatHltbHours(game.hltbMainHours, lang) },
          { label: "Extras", hours: formatHltbHours(game.hltbMainExtraHours, lang) },
          { label: "100%", hours: formatHltbHours(game.hltbCompletionistHours, lang) },
        ].filter((duration) => duration.hours !== null);
        const hasMeta = durations.length > 0 || reviews.length > 0 || year !== null;

        return (
          <li key={game.slug} className={styles.item}>
            <Link href={localizeHref(`/explore/games/${game.slug}`, lang)} className={styles.card}>
              <span className={styles.title}>{game.title}</span>
              {hasMeta && (
                <span className={styles.meta}>
                  {durations.length > 0 && (
                    <span className={styles.durations}>
                      {durations.map(({ label, hours }) => (
                        <span className={styles.duration} key={label}>
                          <span>{label}</span>
                          <span className={styles.durationHours}>{hours}h</span>
                        </span>
                      ))}
                    </span>
                  )}
                  {reviews.length > 0 && (
                    <span className={styles.ratings}>
                      {reviews.map(({ source, value }) => (
                        <span className={styles.rating} key={source}>
                          <span className={styles.ratingSource}>{source}</span>
                          <span className={styles.ratingValue} data-tier={scoreTier(value)}>
                            {formatReviewScore(value, lang)}/100
                          </span>
                        </span>
                      ))}
                    </span>
                  )}
                  {year && <span className={styles.year}>{year}</span>}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
