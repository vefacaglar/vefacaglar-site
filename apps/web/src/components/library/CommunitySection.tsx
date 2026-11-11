import Link from "next/link";
import { formatDate } from "../../lib/formatDate";
import { communityPageHref, type CommunityPage } from "../../lib/community";
import { localizeHref } from "../../lib/localizeHref";
import styles from "./CommunitySection.module.css";
import { communityLabels } from "./communityLabels";


export default function CommunitySection({ data, path, params, lang = "en" }: {
  data: CommunityPage | null;
  path: string;
  params: Record<string, string | undefined>;
  lang?: string;
}) {
  const labels = communityLabels(lang);
  return <section className={styles.section} id="community">
    <div className={styles.heading}><h2>{labels.heading}</h2>
      {data && <div><p className={styles.rating}>{labels.siteRating} <strong>{data.rating.average === null ? "—" : data.rating.average.toFixed(1)}</strong> / {data.rating.scale} <span>({data.rating.count} {data.rating.count === 1 ? labels.rating : labels.ratings})</span></p><p className={styles.ratingHint}>{labels.ratingHint}</p></div>}
    </div>
    {!data ? <p className={styles.muted}>{labels.unavailable}</p> : data.entries.length === 0 ?
      <p className={styles.muted}>{labels.empty}</p> : <ul className={styles.entries}>
        {data.entries.map((entry) => <li className={styles.entry} key={entry.id}>
          <div className={styles.entryHeader}>
            <Link href={localizeHref(`/profile/${encodeURIComponent(entry.author.username)}`, params.lang ?? lang)}>{entry.author.displayName}</Link>
            <span>{entry.rating === null ? null : `${entry.rating} / ${data.rating.scale}`}</span>
          </div>
          <p className={styles.meta}>{[entry.status ? labels.statuses[entry.status] : null, entry.watchedOn === null ? labels.noDate : entry.watchedOn ? `${labels.watched} ${formatDate(entry.watchedOn, lang)}` : null,
            entry.completedAt ? `${labels.completed} ${formatDate(entry.completedAt, lang)}` : null, entry.startedAt ? `${labels.started} ${formatDate(entry.startedAt, lang)}` : null].filter(Boolean).join(" · ")}</p>
          {entry.text && <p className={styles.review}>{entry.text}</p>}
          <time className={styles.sharedAt} dateTime={entry.sharedAt}>{labels.shared} {formatDate(entry.sharedAt, lang)}</time>
        </li>)}
      </ul>}
    {data && data.totalPages > 1 && <nav className={styles.pagination} aria-label={labels.pages}>
      {data.page > 1 && <Link className="btnGhost" href={localizeHref(communityPageHref(path, params, data.page - 1), lang)}>{labels.previous}</Link>}
      <span>{labels.pageOf.replace("{current}", String(data.page)).replace("{total}", String(data.totalPages))}</span>
      {data.page < data.totalPages && <Link className="btnGhost" href={localizeHref(communityPageHref(path, params, data.page + 1), lang)}>{labels.next}</Link>}
    </nav>}
  </section>;
}
