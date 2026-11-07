import styles from "./games.module.css";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { localizedAlternates } from "../../lib/seo";
import { libraryMetadata } from "../../lib/librarySeo";
import { getPublicGames } from "../../lib/data";
import Pagination from "../components/Pagination";
import LibraryMasthead from "../../components/library/LibraryMasthead";
import CatalogSearch from "../../components/library/CatalogSearch";
import GameGrid, { type GameCardItem } from "./GameGrid";

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
  const games = (data?.items ?? []) as GameCardItem[];

  return (
    <div>
      <LibraryMasthead title={dict.games} subtitle={dict.games_subtitle}>
        <CatalogSearch basePath="/games" initialQuery={query} placeholder={dict.games_search_placeholder} />
      </LibraryMasthead>

      {games.length === 0 ? (
        <p className={styles.noResults}>{dict.no_games}</p>
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
