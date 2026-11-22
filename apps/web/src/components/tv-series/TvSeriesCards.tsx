import Link from "next/link";
import { localizeHref } from "../../lib/localizeHref";
import { tvCount, tvRating, tvSeriesYears, type TvSeriesCard } from "../../lib/tvSeries";
import styles from "./tvSeries.module.css";
export default function TvSeriesCards({ series, lang }: { series: TvSeriesCard[]; lang: string }) {
  return <ul className={styles.list}>{series.map((show) => {
    const rating = tvRating(show.rating);
    return <li key={show.id} className={styles.item}>
      <Link href={localizeHref(`/explore/tv-series/${show.id}`, lang)} className={styles.card}>
        <span className={styles.heading}><span className={styles.title}>{show.title}</span><span className={styles.year}>{tvSeriesYears(show)}</span></span>
        <span className={styles.meta}>
          {show.seasonCount !== null && <span>{tvCount(show.seasonCount, "season")}</span>}
          {show.episodeCount !== null && <span>{tvCount(show.episodeCount, "episode")}</span>}
          {show.status && <span>{show.status}</span>}
          {rating && <span>TVmaze <strong className={styles.rating}>{rating}</strong></span>}
        </span>
      </Link>
    </li>;
  })}</ul>;
}
