import { publicCompletionReports, publicCompletionSummary, publicCompletionMasterSummary } from "../catalog/completion-times/completion-public";
import { usableCompletionTimes } from "../catalog/completion-times/completion-times-quality";
import type { GameCard } from "../catalog/games.repository.interface";
import { publicCriticScore } from "./critic-score";
import type { PublicGameCard } from "./list/list.schema";

/**
 * A shared public projection for the library and company catalogs.
 * Stored IGDB cover URLs, unattributed third-party review scores, and legacy completion durations are never exposed on public endpoints.
 */
export function publicGameCard(game: GameCard): PublicGameCard {
  const completionReports = publicCompletionReports(game.completionReports);
  return {
    slug: game.slug,
    title: game.title,
    coverImageUrl: null,
    releaseDate: game.releaseDate,
    metacriticScore: null,
    openCriticScore: null,
    criticScore: publicReviewScore(publicCriticScore(game.criticScore, game.criticScoreCount)),
    popularityScore: Number.isFinite(game.popularityScore) && game.popularityScore! >= 0 && game.popularityScore! <= 1
      ? game.popularityScore : null,
    completionTimes: usableCompletionTimes(game.completionTimes),
    completionReports,
    completionSummary: publicCompletionSummary(game.completionTimes, completionReports),
    completionMasterSummary: publicCompletionMasterSummary(game.completionTimes, completionReports),
    hltbMainHours: null,
    hltbMainExtraHours: null,
    hltbCompletionistHours: null,
  };
}

function publicReviewScore(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
