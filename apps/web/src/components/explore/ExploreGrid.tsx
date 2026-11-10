import Link from "next/link";
import { localizeHref } from "../../lib/localizeHref";
import type { MovieCard } from "../../lib/movies";
import GenericPoster from "../movies/GenericPoster";
import PosterCredit from "../movies/PosterCredit";
import styles from "./ExploreGrid.module.css";

export interface ExploreGame {
  slug: string;
  title: string;
  releaseDate: string | null;
}

export default function ExploreGrid({ games, movies, lang, emptyMessage }: {
  games: ExploreGame[];
  movies: MovieCard[];
  lang: string;
  emptyMessage: string;
}) {
  const items = [
    ...games.map((item) => ({ type: "game" as const, item })),
    ...movies.map((item) => ({ type: "movie" as const, item })),
  ];

  if (items.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return <ul className={styles.grid}>
    {items.map(({ type, item }) => {
      const isGame = type === "game";
      const image = isGame
        ? null
        : item.posterImageUrl && item.posterAttribution ? item.posterImageUrl : null;
      const year = isGame ? item.releaseDate?.slice(0, 4) : item.releaseYear;

      return <li key={`${type}:${item.slug}`}>
        <Link href={localizeHref(`/explore/${isGame ? "games" : "movies"}/${encodeURIComponent(item.slug)}`, lang)} className={styles.card}>
          <span className={styles.cover} data-type={type} aria-hidden="true">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" loading="lazy" />
            ) : <GenericPoster kicker={isGame ? "Game" : "Film"} title={item.title} year={year} />}
          </span>
          <span className={styles.caption}>
            <span className={styles.kind}>{isGame ? "Game" : "Movie"}</span>
            <span className={styles.title}>{item.title}</span>
            {year && <span className={styles.year}>{year}</span>}
          </span>
        </Link>
        {type === "movie" && image && <PosterCredit attribution={item.posterAttribution} />}
      </li>;
    })}
  </ul>;
}
