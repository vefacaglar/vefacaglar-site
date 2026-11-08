import type { MovieCard } from "../../lib/movies";
import styles from "./posterCredit.module.css";

export default function PosterCredit({ attribution }: { attribution: MovieCard["posterAttribution"] }) {
  if (!attribution) return null;
  return <p className={styles.credit}>
    Poster: {attribution.artist && <>{attribution.artist} · </>}
    {attribution.licenseUrl ? <a href={attribution.licenseUrl}>{attribution.license}</a> : attribution.license} · <a href={attribution.sourceUrl}>{attribution.provider === "wikipedia" ? "Wikipedia" : "Wikimedia Commons"}</a>
  </p>;
}
