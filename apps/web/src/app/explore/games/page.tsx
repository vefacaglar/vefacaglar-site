import styles from "./games.module.css";
import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary } from "../../../dictionaries";
import { localizedAlternates } from "../../../lib/seo";
import { libraryMetadata } from "../../../lib/librarySeo";
import { getPublicGames } from "../../../lib/data";
import Pagination from "../../components/Pagination";
import LibraryMasthead from "../../../components/library/LibraryMasthead";
import GameSearchAutocomplete from "../../../components/library/GameSearchAutocomplete";
import { getGameSearchCompanies } from "../../../lib/gameSearchApi";
import GameGrid, { type GameCardItem } from "./GameGrid";
import GameSearchCompanies from "./GameSearchCompanies";

export async function generateMetadata() {
  const lang = await getActiveLanguage();
  const dict = getDictionary(lang);
  return libraryMetadata({
    section: "games",
    title: dict.games,
    description: dict.games_subtitle,
    alternates: localizedAlternates("/explore/games", lang),
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

  // Company matches only lead the first results page of a search.
  const [data, companies] = await Promise.all([
    getPublicGames(page, query || undefined),
    query && page === 1 ? getGameSearchCompanies(query) : null,
  ]);
  const games = (data?.items ?? []) as GameCardItem[];
  const hasCompanies = !!companies && (companies.developers.length > 0 || companies.publishers.length > 0);

  return (
    <div>
      <LibraryMasthead title={dict.games} subtitle={dict.games_subtitle}>
        <GameSearchAutocomplete initialQuery={query} placeholder={dict.games_search_placeholder} />
      </LibraryMasthead>

      {companies && <GameSearchCompanies companies={companies} lang={lang} />}

      {games.length === 0 ? (
        <p className={styles.noResults}>{query && page === 1 && !hasCompanies ? dict.games_search_no_results : dict.no_games}</p>
      ) : (
        <>
          <GameGrid games={games} lang={lang} />
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
