import type { GameCard } from "../catalog/games.repository.interface";
import { publicCriticScore } from "./critic-score";
import type { PublicGameCard } from "./list/list.schema";

/** A shared public projection for the library and company catalogs. */
export function publicGameCard(game: GameCard): PublicGameCard {
  return {
    slug: game.slug,
    title: game.title,
    coverImageUrl: game.coverImageUrl,
    releaseDate: game.releaseDate,
    metacriticScore: publicReviewScore(game.metacriticScore),
    openCriticScore: publicReviewScore(game.openCriticScore),
    criticScore: publicReviewScore(publicCriticScore(game.criticScore, game.criticScoreCount)),
    popularityScore: Number.isFinite(game.popularityScore) && game.popularityScore! >= 0 && game.popularityScore! <= 1
      ? game.popularityScore : null,
    hltbMainHours: publicHours(game.hltbMainHours),
    hltbMainExtraHours: publicHours(game.hltbMainExtraHours),
    hltbCompletionistHours: publicHours(game.hltbCompletionistHours),
  };
}

function publicReviewScore(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function publicHours(value: string | null | undefined): string | null {
  const hours = Number(value);
  return value != null && Number.isFinite(hours) && hours > 0 && hours < 100_000 ? value : null;
}
