import Link from "next/link";
import styles from "./ProfileGameList.module.css";
import { getDictionary, type Dictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { formatDate, formatRelative, parseDateKey } from "../../../lib/formatDate";
import type { LibraryGame } from "../../../lib/profileLibrary";
import { statusLabel } from "../../explore/games/gameLogStatus";
import ProfileGameListRow from "./ProfileGameListRow";

type ProfileGameListProps = {
  games: LibraryGame[];
  lang: string;
  isOwner: boolean;
  /** Whose ratings these are, for visitors: "Vefa 8/10" rather than "You 8/10". */
  ownerName: string;
  /** Mark the playtime column as the sorted one. */
  sortedByPlaytime?: boolean;
  /** Add the completion date under each title (when the list is ordered by it). */
  showCompletedAt?: boolean;
};

/** A 0-100 score on a ten-point scale: 80 → "8", 85 → "8.5" (or always one decimal). */
function outOfTen(score: number, lang: string, fixed = false): string {
  return new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-GB", {
    minimumFractionDigits: fixed ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(Math.round(score) / 10);
}

/** Compact date, e.g. "12 Mar 2025". */
function shortDate(key: string, lang: string): string {
  const date = parseDateKey(key);
  if (!date) return "";
  return new Intl.DateTimeFormat(lang === "tr" ? "tr-TR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** A figure, or a dash that reads as words to a screen reader. */
function Figure({ value, unit, empty }: { value: string | null; unit: string; empty: string }) {
  if (value === null) {
    return (
      <>
        <span className={styles.dash} aria-hidden="true">
          —
        </span>
        <span className={styles.visuallyHidden}>{empty}</span>
      </>
    );
  }
  return (
    <>
      {value}
      <span className={styles.unit}>{unit}</span>
    </>
  );
}

/** "3 days ago", with the full date on hover. */
function Ago({ iso, lang, now }: { iso: string; lang: string; now: number }) {
  const relative = formatRelative(iso, lang, now);
  if (!relative) return <>—</>;
  const date = new Date(iso);
  return (
    <time dateTime={iso} title={formatDate(date, lang)}>
      {relative}
    </time>
  );
}

function Detail({
  game,
  dict,
  lang,
  now,
  who,
  editHref,
}: {
  game: LibraryGame;
  dict: Dictionary;
  lang: string;
  now: number;
  who: string;
  editHref: string | null;
}) {
  const playtime = game.playtimeHours !== null ? String(game.playtimeHours) : null;
  return (
    <div className={styles.detail}>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{dict.list_status}</dt>
          <dd>
            <span className={styles.chip}>{statusLabel(dict, game.status)}</span>
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{dict.list_playtime}</dt>
          <dd className={styles.factFigure}>
            <Figure value={playtime} unit={dict.hours_short} empty={dict.list_no_playtime} />
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{dict.list_rated}</dt>
          <dd className={styles.rated}>
            <span className={styles.ratedLine}>
              <span className={styles.ratedWho}>{who}</span>
              <span className={styles.factFigure}>
                {game.rating !== null ? (
                  <>
                    {outOfTen(game.rating, lang)}
                    <span className={styles.unit}>/10</span>
                  </>
                ) : (
                  <span className={styles.notRated}>{dict.list_not_rated}</span>
                )}
              </span>
            </span>
            {game.criticScore !== null && (
              <span className={styles.ratedLine}>
                <span className={styles.ratedWho}>{dict.critic_score}</span>
                <span className={styles.factFigure}>
                  {outOfTen(game.criticScore, lang, true)}
                  <span className={styles.unit}>/10</span>
                </span>
              </span>
            )}
          </dd>
        </div>
        {game.completedAt && (
          <div className={styles.fact}>
            <dt>{dict.log_completed}</dt>
            <dd>
              <time dateTime={game.completedAt}>{formatDate(game.completedAt, lang)}</time>
            </dd>
          </div>
        )}
        <div className={styles.fact}>
          <dt>{dict.sort_activity}</dt>
          <dd>
            <Ago iso={game.lastActivityAt || game.lastLoggedAt} lang={lang} now={now} />
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{dict.list_added}</dt>
          <dd>
            <Ago iso={game.addedAt} lang={lang} now={now} />
          </dd>
        </div>
      </dl>
      {editHref && (
        <Link href={editHref} className={`btnGhost ${styles.detailEdit}`}>
          {dict.log_edit_title}
        </Link>
      )}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10.5 2.5 13.5 5.5 5.5 13.5H2.5V10.5L10.5 2.5Z" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8.5 4.5 11.5 7.5" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

/**
 * A user's games as a ledger: title and platform, then playtime and rating as
 * right-aligned figures. Each row opens into a panel with the rest of the record.
 * Owners get a shortcut to edit their latest log.
 */
export default function ProfileGameList({
  games,
  lang,
  isOwner,
  ownerName,
  sortedByPlaytime = false,
  showCompletedAt = false,
}: ProfileGameListProps) {
  const dict = getDictionary(lang);
  // One clock for every row, so relative dates agree with each other.
  const now = Date.now();
  const columns = isOwner ? 5 : 4;
  const who = isOwner ? dict.list_rated_you : ownerName;

  return (
    <table className={styles.table}>
      <caption className={styles.visuallyHidden}>{dict.games}</caption>
      <thead>
        <tr>
          <th scope="col" className={styles.headGame}>
            {dict.list_game}
          </th>
          <th
            scope="col"
            className={sortedByPlaytime ? `${styles.headFigure} ${styles.headSorted}` : styles.headFigure}
            aria-sort={sortedByPlaytime ? "descending" : undefined}
          >
            {dict.list_playtime}
          </th>
          <th scope="col" className={styles.headFigure}>
            {dict.list_rating}
          </th>
          {isOwner && (
            <th scope="col" className={styles.editCell}>
              <span className={styles.visuallyHidden}>{dict.edit}</span>
            </th>
          )}
          <th scope="col" className={styles.toggleHead}>
            <span className={styles.visuallyHidden}>{dict.list_details}</span>
          </th>
        </tr>
      </thead>
      {games.map((game) => {
        const href = localizeHref(`/explore/games/${game.slug}`, lang);
        const editHref =
          isOwner && game.latestLogId
            ? localizeHref(`/explore/games/${game.slug}/logs/${encodeURIComponent(game.latestLogId)}`, lang)
            : null;
        const finished = showCompletedAt && game.completedAt ? shortDate(game.completedAt, lang) : "";
        const playtime = game.playtimeHours !== null ? String(game.playtimeHours) : null;
        const rating = game.rating !== null ? outOfTen(game.rating, lang) : null;

        return (
          <ProfileGameListRow
            key={game.slug}
            detailId={`game-detail-${game.slug}`}
            status={game.status}
            columns={columns}
            toggleLabel={dict.list_details_for.replace("{title}", game.title)}
            cells={
              <>
                <th scope="row" className={styles.titleCell}>
                  <span className={styles.marker} aria-hidden="true" />
                  <span className={styles.titleRow}>
                    <Link href={href} className={styles.thumb} tabIndex={-1} aria-hidden="true">
                      <span className={styles.thumbFallback}>{game.title.slice(0, 1)}</span>
                    </Link>
                    <span className={styles.titleBlock}>
                      <Link href={href} className={styles.titleLink}>
                        {game.title}
                      </Link>
                      {game.platformName && <span className={styles.platform}>{game.platformName}</span>}
                      {finished && (
                        <time className={styles.finished} dateTime={game.completedAt ?? undefined}>
                          {dict.list_finished_on.replace("{date}", finished)}
                        </time>
                      )}
                    </span>
                  </span>
                </th>
                <td className={styles.figure}>
                  <Figure value={playtime} unit={dict.hours_short} empty={dict.list_no_playtime} />
                </td>
                <td className={styles.figure}>
                  <Figure value={rating} unit="/10" empty={dict.list_not_rated} />
                </td>
                {isOwner && (
                  <td className={styles.editCell}>
                    {editHref && (
                      <Link
                        href={editHref}
                        className={styles.iconButton}
                        aria-label={dict.list_edit_log_for.replace("{title}", game.title)}
                        title={dict.log_edit_title}
                      >
                        <PencilIcon />
                      </Link>
                    )}
                  </td>
                )}
              </>
            }
            detail={<Detail game={game} dict={dict} lang={lang} now={now} who={who} editHref={editHref} />}
          />
        );
      })}
    </table>
  );
}
