import Link from "next/link";
import { formatDate } from "../../lib/formatDate";
import { communityPageHref, type CommunityPage } from "../../lib/community";
import { localizeHref } from "../../lib/localizeHref";
import styles from "./CommunitySection.module.css";

const statuses = { backlog: "Backlog", playing: "Playing", completed: "Completed", on_hold: "On hold", abandoned: "Abandoned" };

export default function CommunitySection({ data, path, params }: {
  data: CommunityPage | null;
  path: string;
  params: Record<string, string | undefined>;
}) {
  return <section className={styles.section} id="community">
    <div className={styles.heading}><h2>Community</h2>
      {data && <div><p className={styles.rating}>Site rating <strong>{data.rating.average === null ? "—" : data.rating.average.toFixed(1)}</strong> / {data.rating.scale} <span>({data.rating.count} {data.rating.count === 1 ? "rating" : "ratings"})</span></p><p className={styles.ratingHint}>Based on ratings from public profiles.</p></div>}
    </div>
    {!data ? <p className={styles.muted}>Community activity is temporarily unavailable.</p> : data.entries.length === 0 ?
      <p className={styles.muted}>No shared activity yet.</p> : <ul className={styles.entries}>
        {data.entries.map((entry) => <li className={styles.entry} key={entry.id}>
          <div className={styles.entryHeader}>
            <Link href={localizeHref(`/profile/${encodeURIComponent(entry.author.username)}`, params.lang ?? "en")}>{entry.author.displayName}</Link>
            <span>{entry.rating === null ? null : `${entry.rating} / ${data.rating.scale}`}</span>
          </div>
          <p className={styles.meta}>{[entry.status ? statuses[entry.status] : null, entry.watchedOn ? `Watched ${formatDate(entry.watchedOn, "en")}` : null,
            entry.completedAt ? `Completed ${formatDate(entry.completedAt, "en")}` : null, entry.startedAt ? `Started ${formatDate(entry.startedAt, "en")}` : null].filter(Boolean).join(" · ")}</p>
          {entry.text && <p className={styles.review}>{entry.text}</p>}
          <time className={styles.sharedAt} dateTime={entry.sharedAt}>Shared {formatDate(entry.sharedAt, "en")}</time>
        </li>)}
      </ul>}
    {data && data.totalPages > 1 && <nav className={styles.pagination} aria-label="Community pages">
      {data.page > 1 && <Link className="btnGhost" href={communityPageHref(path, params, data.page - 1)}>Previous</Link>}
      <span>Page {data.page} of {data.totalPages}</span>
      {data.page < data.totalPages && <Link className="btnGhost" href={communityPageHref(path, params, data.page + 1)}>Next</Link>}
    </nav>}
  </section>;
}
