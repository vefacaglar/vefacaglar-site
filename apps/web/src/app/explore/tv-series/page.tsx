import Link from "next/link";
import LibraryMasthead from "../../../components/library/LibraryMasthead";
import TvSeriesCards from "../../../components/tv-series/TvSeriesCards";
import TvAttribution from "../../../components/tv-series/TvAttribution";
import Pagination from "../../components/Pagination";
import { getActiveLanguage } from "../../../lib/lang";
import { localizeHref } from "../../../lib/localizeHref";
import { getTvSeriesList, tvPage } from "../../../lib/tvSeries";
import { libraryMetadata } from "../../../lib/librarySeo";
import styles from "./tv-series.module.css";
export const metadata = libraryMetadata({ section: "tv-series", title: "TV Series", description: "Explore TV series, seasons, and episodes." });
export default async function TvSeriesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const page = tvPage(params.page);
  const q = params.q?.trim().slice(0, 140) || "";
  const [lang, data] = await Promise.all([getActiveLanguage(), getTvSeriesList(page, q || undefined)]);
  return <div>
    <LibraryMasthead title="TV Series" subtitle="Discover series, seasons, and episodes.">
      <form action={localizeHref("/explore/tv-series", lang)} role="search" className={styles.search}>
        {lang !== "en" && <input type="hidden" name="lang" value={lang} />}
        <input type="search" name="q" defaultValue={q} maxLength={140} placeholder="Search TV series" aria-label="Search TV series" className={styles.searchInput} />
        <button type="submit" className="btnGhost">Search</button>
      </form>
    </LibraryMasthead>
    {data?.items.length ? <>
      <TvSeriesCards series={data.items} lang={lang} />
      <Pagination currentPage={page} totalPages={data.totalPages} className={styles.pagination} labels={{ previous: "← Previous", next: "Next →", pageOf: "Page {current} of {total}" }} />
    </> : <p className={styles.empty}>{q ? "No TV series match your search." : "TV series are being added to the catalog."}</p>}
    {!q && data && <p className={styles.ranking}>
      {data.ranking.isFresh ? "Current popularity" : "Ordered by title"}
      {data.ranking.isFresh && data.ranking.sources.map((source) => <span key={source.provider}> · {source.provider === "tmdb" ? <a href="https://developer.themoviedb.org/docs/daily-id-exports">TMDB popularity</a> : source.provider === "wikipedia" ? <a href="https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html">Wikipedia interest</a> : <span>{source.provider}</span>} {source.windowStart === source.sourceDate ? source.sourceDate : `${source.windowStart}–${source.sourceDate}`}</span>)}
      {" · "}<Link href="/credits">Data credits</Link>
    </p>}
    <TvAttribution />
  </div>;
}
