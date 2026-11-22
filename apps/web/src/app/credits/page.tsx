import type { Metadata } from "next";
import styles from "./credits.module.css";

export const metadata: Metadata = { title: "Data credits" };

export default function DataCredits() {
  return <article className={styles.credits}>
    <h1>Data credits</h1>
    <section>
      <h2>TMDB</h2>
      <a href="https://www.themoviedb.org"><img className={styles.logo} src="/logos/tmdb.svg" alt="TMDB" /></a>
      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <p>Movie popularity uses the <a href="https://developer.themoviedb.org/docs/daily-id-exports">daily movie ID export</a>.</p>
    </section>
    <section>
      <h2>Netflix</h2>
      <p>Global weekly film views come from the <a href="https://www.netflix.com/tudum/top10">Netflix Top 10 dataset</a>.</p>
    </section>
    <section>
      <h2>Wikimedia</h2>
      <p>Movie facts and identities come from <a href="https://www.wikidata.org">Wikidata</a> under CC0.
        Recent human article views come from <a href="https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html">Wikimedia Analytics</a>.</p>
    </section>
  </article>;
}
