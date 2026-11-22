import type { Metadata } from "next";
import styles from "./credits.module.css";

export const metadata: Metadata = { title: "Data credits" };

export default function DataCredits() {
  return <article className={styles.credits}>
    <h1>Data credits</h1>
    <section>
      <h2>TVmaze</h2>
      <p>TV series, seasons, episodes, cast, person details, summaries and TVmaze ratings come from the <a href="https://www.tvmaze.com/api">TVmaze API</a>. The data is shared under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>, with summaries converted to plain text. Source links are included on series and episode pages.</p>
    </section>
    <section>
      <h2>TMDB</h2>
      <a href="https://www.themoviedb.org"><img className={styles.logo} src="/logos/tmdb.svg" alt="TMDB" /></a>
      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <p>Movie and TV series popularity use the <a href="https://developer.themoviedb.org/docs/daily-id-exports">daily ID exports</a>.</p>
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
