import Link from "next/link";
import { notFound } from "next/navigation";
import { getTvSeason, tvSeriesId, tvSeasonName, tvCount, tvDate } from "../../../../../../lib/tvSeries";
import { getActiveLanguage } from "../../../../../../lib/lang";
import { localizeHref } from "../../../../../../lib/localizeHref";
import { libraryMetadata } from "../../../../../../lib/librarySeo";
import TvAttribution from "../../../../../../components/tv-series/TvAttribution";
import TvEpisodes from "../../../../../../components/tv-series/TvEpisodes";
import styles from "../../../tv-detail.module.css";
type Props = { params: Promise<{ id: string; seasonId: string }> };
export async function generateMetadata({ params }: Props) {
  const values = await params;
  const id = tvSeriesId(values.id), seasonId = tvSeriesId(values.seasonId);
  const data = id === null || seasonId === null ? null : await getTvSeason(id, seasonId);
  return data ? libraryMetadata({ section: "tv-series", title: `${data.series.title} · ${tvSeasonName(data.season)}`, description: `Episodes of ${tvSeasonName(data.season)} of ${data.series.title}.` }) : {};
}
export default async function TvSeasonPage({ params }: Props) {
  const values = await params;
  const id = tvSeriesId(values.id), seasonId = tvSeriesId(values.seasonId);
  if (id === null || seasonId === null) notFound();
  const [data, lang] = await Promise.all([getTvSeason(id, seasonId), getActiveLanguage()]);
  if (!data) notFound();
  const regular = data.episodes.filter((episode) => !episode.isSpecial);
  const specials = data.episodes.filter((episode) => episode.isSpecial);
  return <article className={styles.detail}>
    <header className={styles.header}>
      <Link className={styles.back} href={localizeHref(`/explore/tv-series/${id}`, lang)}>← {data.series.title}</Link>
      <h1 className={styles.title}>{tvSeasonName(data.season)}</h1>
      <p className={styles.byline}>
        {[data.season.episodeCount === null ? null : tvCount(data.season.episodeCount, "episode"), data.season.specialCount ? tvCount(data.season.specialCount, "special") : null, tvDate(data.season.premiered)].filter(Boolean).join(" · ")}
      </p>
    </header>
    {data.season.summary && <p className={styles.summary}>{data.season.summary}</p>}
    {data.season.episodeOrder !== null && <p className={styles.note}>Reported episode order · {tvCount(data.season.episodeOrder, "episode")}</p>}
    {data.hierarchyStatus === "pending" && <p className={styles.note}>Episode details are being added.</p>}
    {data.hierarchyStatus === "complete" && data.episodes.length === 0 && <p className={styles.note}>No episodes have been reported for this season.</p>}
    {regular.length > 0 && <section className={styles.section} aria-labelledby="season-episodes"><h2 id="season-episodes">Episodes</h2><TvEpisodes episodes={regular} /></section>}
    {specials.length > 0 && <section className={styles.section} aria-labelledby="season-specials"><h2 id="season-specials">Specials</h2><TvEpisodes episodes={specials} special /></section>}
    <TvAttribution sourceUrl={data.sourceUrl} />
  </article>;
}
