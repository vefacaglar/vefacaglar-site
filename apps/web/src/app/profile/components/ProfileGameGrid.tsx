import Link from "next/link";
import shelf from "../../games/games.module.css";
import styles from "../profile.module.css";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import type { LibraryGame } from "../../../lib/profileLibrary";
import { statusLabel } from "../../games/gameLogStatus";
import { scoreTier } from "../../games/scoreTier";

/**
 * A user's games as a cover wall, sharing the games shelf's cards. The plate on the
 * cover is the user's own rating; the caption carries their status and playtime.
 */
export default function ProfileGameGrid({ games, lang }: { games: LibraryGame[]; lang: string }) {
  const dict = getDictionary(lang);

  return (
    <ul className={shelf.grid}>
      {games.map((game) => (
        <li key={game.slug}>
          <Link href={localizeHref(`/games/${game.slug}`, lang)} className={shelf.card}>
            <div className={shelf.cover}>
              {game.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.coverImageUrl} alt="" loading="lazy" />
              ) : (
                <span className={shelf.coverFallback}>{game.title}</span>
              )}
              {game.rating !== null && (
                <span
                  className={shelf.score}
                  data-tier={scoreTier(game.rating)}
                  aria-label={`${dict.rating_label}: ${game.rating}/100`}
                >
                  {game.rating}
                </span>
              )}
            </div>
            <span className={styles.cardCaption}>
              <span className={shelf.title}>{game.title}</span>
              <span className={styles.cardMeta}>
                <span className={styles.status}>{statusLabel(dict, game.status)}</span>
                {game.playtimeHours !== null && <span>{`${game.playtimeHours}${dict.hours_short}`}</span>}
                {game.logCount > 1 && <span>{dict.log_count.replace("{count}", String(game.logCount))}</span>}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
