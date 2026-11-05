import Link from "next/link";
import styles from "./games.module.css";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { localizeHref } from "../../lib/localizeHref";
import { localizedAlternates } from "../../lib/seo";
import { libraryMetadata } from "../../lib/librarySeo";
import { getPublicGames } from "../../lib/data";
import Pagination from "../components/Pagination";
import LibraryMasthead from "../../components/library/LibraryMasthead";
import GamesSearch from "./GamesSearch";
import { scoreTier } from "./scoreTier";
import { formatHltbHours, formatReviewScore, selectReviewScores } from "./cardMetrics";

type GameCard = {
  slug: string;
  title: string;
  coverImageUrl: string | null;
  releaseDate: string | null;
  // Optional while an older API deployment does not expose the provider fields.
  metacriticScore?: number | null;
  openCriticScore?: number | null;
  criticScore?: number | null;
  hltbMainHours?: string | null;
  hltbMainExtraHours?: string | null;
  hltbCompletionistHours?: string | null;
};

export async function generateMetadata() {
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  return libraryMetadata({
    section: "games",
    title: dict.games,
    description: dict.games_subtitle,
    alternates: localizedAlternates("/games", lang),
  });
}

interface GamesProps {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export default async function Games(props: GamesProps) {
  const searchParams = await props.searchParams;
  const page = Math.max(1, Number(searchParams.page) || 1);
  const query = searchParams.q?.trim() || "";
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);

  const data = await getPublicGames(page, query || undefined);
  const games = (data?.items ?? []) as GameCard[];

  return (
    <div>
      <LibraryMasthead title={dict.games} subtitle={dict.games_subtitle}>
        <GamesSearch initialQuery={query} />
      </LibraryMasthead>

      {games.length === 0 ? (
        <p className={styles.noResults}>{dict.no_games}</p>
      ) : (
        <>
          <ul className={styles.grid}>
            {games.map((game) => {
              const reviews = selectReviewScores(game);
              const durations = [
                { label: "Main story", hours: formatHltbHours(game.hltbMainHours, lang) },
                { label: "Main + extras", hours: formatHltbHours(game.hltbMainExtraHours, lang) },
                { label: "Completionist", hours: formatHltbHours(game.hltbCompletionistHours, lang) },
              ].filter((duration) => duration.hours !== null);

              return (
                <li key={game.slug}>
                  <Link href={localizeHref(`/games/${game.slug}`, lang)} className={styles.card}>
                    <div className={styles.cover}>
                      {game.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={game.coverImageUrl} alt="" loading="lazy" />
                      ) : (
                        <span className={styles.coverFallback}>{game.title}</span>
                      )}
                    </div>
                    <span className={styles.caption}>
                      <span className={styles.title}>{game.title}</span>
                      {game.releaseDate && <span className={styles.year}>{game.releaseDate.slice(0, 4)}</span>}
                      {reviews.length > 0 && (
                        <span className={styles.ratings}>
                          {reviews.map(({ source, value }) => (
                            <span className={styles.rating} key={source}>
                              <span className={styles.ratingSource}>{source}</span>
                              <span className={styles.ratingValue} data-tier={scoreTier(value)}>
                                {formatReviewScore(value, lang)}/100
                              </span>
                            </span>
                          ))}
                        </span>
                      )}
                      {durations.length > 0 && (
                        <span className={styles.durations}>
                          <span className={styles.durationsSource}>HowLongToBeat</span>
                          {durations.map(({ label, hours }) => (
                            <span className={styles.duration} key={label}>
                              <span>{label}</span>
                              <span>{hours}h</span>
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pagination
            currentPage={page}
            totalPages={data?.totalPages ?? 0}
            className={styles.pagination}
            labels={{ previous: dict.library_previous, next: dict.library_next, pageOf: dict.library_page_of }}
          />
        </>
      )}
    </div>
  );
}
