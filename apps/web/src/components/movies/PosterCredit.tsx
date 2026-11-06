import type { MovieCard } from "../../lib/movies";
import styles from "./posterCredit.module.css";

export default function PosterCredit({ attribution }: { attribution: MovieCard["posterAttribution"] }) {
  if (!attribution) return null;
  return <p className={styles.credit}>
    Poster: {attribution.artist} · <a href={attribution.licenseUrl}>{attribution.license}</a> · <a href={attribution.sourceUrl}>Wikimedia Commons</a>
  </p>;
}
