import Link from "next/link";
import { localizeHref } from "../../lib/localizeHref";
import { formatHltbHours, formatReviewScore, selectReviewScores } from "./cardMetrics";
import { scoreTier } from "./scoreTier";
import styles from "./GameGrid.module.css";

export type GameCardItem = {
  slug: string;
  title: string;
  coverImageUrl: string | null;
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
        const reviews = selectReviewScores(game);
        const durations = [
          { label: "Main story", hours: formatHltbHours(game.hltbMainHours, lang) },
          { label: "Main + extras", hours: formatHltbHours(game.hltbMainExtraHours, lang) },
          { label: "Completionist", hours: formatHltbHours(game.hltbCompletionistHours, lang) },
        ].filter((duration) => duration.hours !== null);

        return (
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
              <span className={styles.caption}>
                <span className={styles.title}>{game.title}</span>
                {game.releaseDate && <span className={styles.year}>{game.releaseDate.slice(0, 4)}</span>}
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
                {durations.length > 0 && (
                  <span className={styles.durations}>
                    <span className={styles.durationsSource}>HowLongToBeat</span>
                    {durations.map(({ label, hours }) => (
                      <span className={styles.duration} key={label}>
                        <span>{label}</span>
                        <span>{hours}h</span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
