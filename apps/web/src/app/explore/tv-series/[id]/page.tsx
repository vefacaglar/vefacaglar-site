import Link from "next/link";
import { notFound } from "next/navigation";
import { getTvSeries, tvSeriesId, tvSeriesYears, tvSeasonName, tvCount, tvDate, tvRating } from "../../../../lib/tvSeries";
import { getActiveLanguage } from "../../../../lib/lang";
import { localizeHref } from "../../../../lib/localizeHref";
import { libraryMetadata } from "../../../../lib/librarySeo";
import TvAttribution from "../../../../components/tv-series/TvAttribution";
import TvEpisodes from "../../../../components/tv-series/TvEpisodes";
import styles from "../tv-detail.module.css";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const id = tvSeriesId((await params).id);
  const series = id === null ? null : await getTvSeries(id);
  return series ? libraryMetadata({ section: "tv-series", title: series.title, description: series.summary?.slice(0, 180) || `Seasons and episodes of ${series.title}.` }) : {};
}
export default async function TvSeriesDetailPage({ params }: Props) {
  const id = tvSeriesId((await params).id);
  if (id === null) notFound();
  const [series, lang] = await Promise.all([getTvSeries(id), getActiveLanguage()]);
  if (!series) notFound();
  const rating = tvRating(series.rating);
  return <article className={styles.detail}>
    <header className={styles.header}>
      <Link className={styles.back} href={localizeHref("/explore/tv-series", lang)}>← TV Series</Link>
      <h1 className={styles.title}>{series.title}</h1>
      <p className={styles.byline}>{[tvSeriesYears(series), series.status, series.type, series.language].filter(Boolean).join(" · ")}</p>
      {series.genres.length > 0 && <p className={styles.byline}>{series.genres.join(" · ")}</p>}
      <dl className={styles.figures}>
        {series.seasonCount !== null && <div><dt>Seasons</dt><dd>{series.seasonCount}</dd></div>}
        {series.episodeCount !== null && <div><dt>Episodes</dt><dd>{series.episodeCount}</dd></div>}
        {series.specialCount !== null && series.specialCount > 0 && <div><dt>Specials</dt><dd>{series.specialCount}</dd></div>}
        {series.runtimeMinutes !== null && <div><dt>Typical episode</dt><dd>{series.runtimeMinutes}<span> min</span></dd></div>}
        {rating && <div><dt>TVmaze rating</dt><dd>{rating}</dd></div>}
      </dl>
    </header>
    {series.summary && <p className={styles.summary}>{series.summary}</p>}
    {(series.network || series.premiered || series.officialSite) && <dl className={styles.facts}>
      {series.network && <div><dt>Network / streaming</dt><dd>{series.network}</dd></div>}
      {tvDate(series.firstAired ?? series.premiered) && <div><dt>First aired</dt><dd>{tvDate(series.firstAired ?? series.premiered)}</dd></div>}
      {tvDate(series.lastAired ?? series.ended) && <div><dt>Last aired</dt><dd>{tvDate(series.lastAired ?? series.ended)}</dd></div>}
      {series.officialSite && <div><dt>Website</dt><dd><a href={series.officialSite}>Official site ↗</a></dd></div>}
    </dl>}
    <section className={styles.section} aria-labelledby="tv-seasons">
      <h2 id="tv-seasons">Seasons</h2>
      {series.hierarchyStatus === "pending" && <p className={styles.note}>Season and episode details are being added.</p>}
      {series.hierarchyStatus === "complete" && series.seasons.length === 0 && <p className={styles.note}>No seasons have been reported.</p>}
      <ul className={styles.seasons}>{series.seasons.map((season) => <li key={season.id}>
        <Link className={styles.seasonLink} href={localizeHref(`/explore/tv-series/${series.id}/seasons/${season.id}`, lang)}>
          <span className={styles.seasonTitle}>{tvSeasonName(season)}</span>
          <span className={styles.seasonMeta}>
            {season.episodeCount !== null && <span>{tvCount(season.episodeCount, "episode")}</span>}
            {season.specialCount !== null && season.specialCount > 0 && <span>{tvCount(season.specialCount, "special")}</span>}
            {tvDate(season.premiered) && <span>{tvDate(season.premiered)}</span>}
            <span aria-hidden="true">→</span>
          </span>
        </Link>
      </li>)}</ul>
    </section>
    {series.orphanSpecials.length > 0 && <section className={styles.section} aria-labelledby="tv-specials">
      <h2 id="tv-specials">Other specials</h2>
      <TvEpisodes episodes={series.orphanSpecials} special />
    </section>}
    <TvAttribution sourceUrl={series.sourceUrl} updatedAt={series.hierarchyUpdatedAt} />
  </article>;
}
