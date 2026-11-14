import type { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { SEARCH_READER } from "../../../../shared/search/search.tokens";
import type { ISearchReader } from "../../../../shared/search/queries/search-reader.interface";
import { GAMES_REPOSITORY } from "../../../catalog/catalog.tokens";
import type { IGamesRepository, PublicGameSuggestion } from "../../../catalog/games.repository.interface";
import { publicCompanyMatch } from "../companies/companies.handler";
import { publicSearchTerm } from "../search-term";
import { orderSuggestionGroups } from "../../../../shared/search/suggestion-group-order";
import type { GameSuggestion, SuggestionGroup, SuggestQuery, SuggestResponse } from "./suggest.schema";

const LIMIT = 5;
/** Group order on a tie: company groups before the title group (see `orderSuggestionGroups`). */
const TIE_ORDER: SuggestionGroup[] = ["developers", "publishers", "games"];

function releaseYear(date: string | null): number | null {
  const match = date ? /^(\d{4})-/.exec(date) : null;
  return match ? Number(match[1]) : null;
}

function gameSuggestion(game: PublicGameSuggestion): GameSuggestion {
  return { slug: game.slug, title: game.title, releaseYear: releaseYear(game.releaseDate), developer: game.developerName };
}

/** Text-only autocomplete for the public games search box, best-matching group first. */
@injectable()
export class SuggestGamesHandler {
  constructor(
    @inject(SEARCH_READER) private readonly searchReader: ISearchReader,
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
  ) {}

  async handle(request: FastifyRequest<{ Querystring: SuggestQuery }>): Promise<SuggestResponse> {
    const term = publicSearchTerm(request.query.q);
    if (!term) return { developers: [], publishers: [], games: [], order: [...TIE_ORDER] };

    const [developers, publishers, games] = await Promise.all([
      this.searchReader.searchPublicCompanies("developer", { q: term, limit: LIMIT }),
      this.searchReader.searchPublicCompanies("publisher", { q: term, limit: LIMIT }),
      this.suggestGames(term),
    ]);
    const groups = { developers: developers.map(publicCompanyMatch), publishers: publishers.map(publicCompanyMatch), games };
    const order = orderSuggestionGroups(term, TIE_ORDER.map((key) => ({
      key, texts: key === "games" ? groups.games.map((game) => game.title) : groups[key].map((company) => company.name),
    })));
    return { ...groups, order };
  }

  private async suggestGames(term: string): Promise<GameSuggestion[]> {
    // Search (Meilisearch, with a Postgres fallback) owns relevance; Postgres owns current display fields.
    const { items: hits } = await this.searchReader.searchPublicGames({ q: term, page: 1, limit: LIMIT });
    if (!hits.length) return [];
    const current = await this.gamesRepo.findPublicSuggestionsByIds(hits.map((hit) => hit.id));
    const byId = new Map(current.map((game) => [game.id, game]));
    return hits
      .flatMap((hit) => {
        const game = byId.get(hit.id);
        return game ? [gameSuggestion(game)] : [];
      })
      .slice(0, LIMIT);
  }
}
