import Link from "next/link";
import styles from "./tvSeries.module.css";
export default function TvAttribution({ sourceUrl = "https://www.tvmaze.com", updatedAt }: { sourceUrl?: string; updatedAt?: string | null }) {
  return <footer className={styles.attribution}>
    <p>Series, season, episode, cast information and ratings from <a href={sourceUrl}>TVmaze</a>, shared under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA</a>.</p>
    {updatedAt && <p>Season and episode data updated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(updatedAt))}.</p>}
    <Link href="/credits">Data credits</Link>
  </footer>;
}
