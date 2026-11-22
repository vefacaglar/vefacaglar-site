import { tvEpisodeDate, tvRating, type TvEpisode } from "../../lib/tvSeries";
import styles from "./tvSeries.module.css";
export default function TvEpisodes({ episodes, special = false }: { episodes: TvEpisode[]; special?: boolean }) {
  return <ol className={styles.episodes}>{episodes.map((episode) => {
    const rating = tvRating(episode.rating);
    return <li key={episode.id} className={styles.episode}>
      <details>
        <summary className={styles.episodeToggle}>
          <span className={styles.episodeHeading}>
            <span className={styles.episodeNumber}>{special || episode.number === null ? "Special" : `E${String(episode.number).padStart(2, "0")}`}</span>
            <span className={styles.episodeName}>{episode.name || "Untitled episode"}</span>
          </span>
          <span className={styles.meta}>
            {tvEpisodeDate(episode) && <span>{tvEpisodeDate(episode)}</span>}
            {episode.runtimeMinutes !== null && <span>{episode.runtimeMinutes} min</span>}
            {rating && <span>TVmaze {rating}</span>}
          </span>
        </summary>
        <div className={styles.episodeBody}>
          {episode.summary && <p className={styles.summary}>{episode.summary}</p>}
          <a className={styles.sourceLink} href={episode.sourceUrl}>Episode on TVmaze ↗</a>
        </div>
      </details>
    </li>;
  })}</ol>;
}
