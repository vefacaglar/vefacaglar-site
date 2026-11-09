import styles from "./movies.module.css";
import ds from "../../../lib/dashboard-strings";
import type { MovieStats } from "./types";

const format = (value: number) => value.toLocaleString("en-US");

export default function MovieStatsRow({ stats }: { stats: MovieStats | null }) {
  if (!stats) return <p className={styles.muted}>{ds.movies.stats.unavailable}</p>;
  const blocks = [
    { label: ds.movies.stats.publicFilms, value: stats.movieCount },
    { label: ds.movies.stats.withPoster, value: stats.withPosterCount },
    { label: ds.movies.stats.posterBlocked, value: stats.posterBlockedCount },
    { label: ds.movies.stats.catalog, value: stats.catalogCount },
  ];
  return (
    <dl className={styles.stats}>
      {blocks.map((block) => (
        <div key={block.label} className={styles.stat}>
          <dt className={styles.statLabel}>{block.label}</dt>
          <dd className={styles.statValue}>{format(block.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
