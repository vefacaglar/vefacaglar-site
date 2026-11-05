import Link from "next/link";
import shelf from "../../games/games.module.css";
import styles from "../profile.module.css";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { parseDateKey } from "../../../lib/formatDate";
import type { LibraryGame } from "../../../lib/profileLibrary";
import { statusLabel } from "../../games/gameLogStatus";
import { scoreTier } from "../../games/scoreTier";

type ProfileGameGridProps = {
  games: LibraryGame[];
  lang: string;
  isOwner?: boolean;
  /** Add the completion date to each caption (when the shelf is ordered by it). */
  showCompletedAt?: boolean;
  /** Leave the status out when every card on the shelf shares it. */
  hideStatus?: boolean;
};

/** Compact card date, e.g. "12 Mar 2025". */
function shortDate(key: string, lang: string): string {
  const date = parseDateKey(key);
  if (!date) return "";
  return new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * A user's games as a cover wall, sharing the games shelf's cards. The plate on the
 * cover is the user's own rating; the caption carries their status and playtime.
 */
export default function ProfileGameGrid({
  games,
  lang,
  isOwner = true,
  showCompletedAt = false,
  hideStatus = false,
}: ProfileGameGridProps) {
  const dict = getDictionary(lang);

  return (
    <ul className={shelf.grid}>
      {games.map((game) => {
        const completed = showCompletedAt && game.completedAt ? shortDate(game.completedAt, lang) : "";
        const href =
          isOwner && game.latestLogId
            ? localizeHref(`/games/${game.slug}/logs/${encodeURIComponent(game.latestLogId)}`, lang)
            : localizeHref(`/games/${game.slug}`, lang);
        return (
          <li key={game.slug}>
            <Link href={href} className={shelf.card}>
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
                  {!hideStatus && <span className={styles.status}>{statusLabel(dict, game.status)}</span>}
                  {game.playtimeHours !== null && <span>{`${game.playtimeHours}${dict.hours_short}`}</span>}
                </span>
                {completed && (
                  <time className={styles.cardDate} dateTime={game.completedAt ?? undefined}>
                    {completed}
                  </time>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
