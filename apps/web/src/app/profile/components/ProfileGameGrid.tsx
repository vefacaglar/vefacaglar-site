import Link from "next/link";
import GenericPoster from "../../../components/movies/GenericPoster";
import shelf from "./ProfileGameGrid.module.css";
import styles from "../profile.module.css";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { parseDateKey } from "../../../lib/formatDate";
import type { LibraryGame } from "../../../lib/profileLibrary";
import { statusLabel } from "../../explore/games/gameLogStatus";
import { scoreTier } from "../../explore/games/scoreTier";

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

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10.5 2.5 13.5 5.5 5.5 13.5H2.5V10.5L10.5 2.5Z" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8.5 4.5 11.5 7.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
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
        const href = localizeHref(`/explore/games/${game.slug}`, lang);
        const editHref =
          isOwner && game.latestLogId
            ? localizeHref(`/explore/games/${game.slug}/logs/${encodeURIComponent(game.latestLogId)}`, lang)
            : null;
        return (
          <li key={game.slug} className={styles.cardItem}>
            <Link href={href} className={shelf.card}>
              <div className={shelf.cover}>
                <GenericPoster kicker="Game" title={game.title} />
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
            {editHref && (
              <Link
                href={editHref}
                className={styles.cardEdit}
                aria-label={dict.list_edit_log_for.replace("{title}", game.title)}
                title={dict.log_edit_title}
              >
                <PencilIcon />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
