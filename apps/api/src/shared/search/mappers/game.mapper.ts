import type { GameCard, GameWithRelations } from "../../../modules/catalog/games.repository.interface";

/** `releaseTimestamp` of a game without a release date: earlier than any real one. */
export const RELEASE_UNKNOWN = -9_999_999_999;

/** `popularityScore` of a game without one: below any real (0-1) score, so it sorts last. */
export const POPULARITY_UNKNOWN = -1;

export interface GameDoc {
  id: string;
  slug: string;
  title: string;
  originalTitle?: string;
  description?: string;
  coverImageUrl?: string;
  releaseDate?: string;
  metacriticScore?: number;
  openCriticScore?: number;
  criticScore?: number;
  criticScoreCount?: number;
  popularityScore?: number;
  releaseTimestamp: number;
  hltbMainHours?: string;
  hltbMainExtraHours?: string;
  hltbCompletionistHours?: string;
  developerIds: string[];
  developerNames: string[];
  developerSlugs: string[];
  publisherIds: string[];
  publisherNames: string[];
  publisherSlugs: string[];
  genreIds: string[];
  genreNames: string[];
  genreSlugs: string[];
  platformIds: string[];
  platformNames: string[];
  platformSlugs: string[];
  themeIds: string[];
  themeNames: string[];
  themeSlugs: string[];
  createdAt: number;
  updatedAt?: number;
}

function toUnixSeconds(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const d = value instanceof Date ? value : new Date(value);
  return Math.floor(d.getTime() / 1000);
}

/** Maps a game's default (English) content to its search document. */
export function toGameDoc(game: GameWithRelations): GameDoc {
  return {
    id: game.id,
    slug: game.slug,
    title: game.title,
    originalTitle: game.originalTitle ?? undefined,
    description: game.description ?? undefined,
    coverImageUrl: game.coverImageUrl ?? undefined,
    releaseDate: game.releaseDate ?? undefined,
    metacriticScore: game.metacriticScore ?? undefined,
    openCriticScore: game.openCriticScore ?? undefined,
    criticScore: game.criticScore ?? undefined,
    criticScoreCount: game.criticScoreCount ?? undefined,
    popularityScore: game.popularityScore ?? POPULARITY_UNKNOWN,
    releaseTimestamp: game.releaseDate ? toUnixSeconds(game.releaseDate) : RELEASE_UNKNOWN,
    hltbMainHours: game.hltbMainHours ?? undefined,
    hltbMainExtraHours: game.hltbMainExtraHours ?? undefined,
    hltbCompletionistHours: game.hltbCompletionistHours ?? undefined,
    developerIds: game.developers.map((d) => d.id),
    developerNames: game.developers.map((d) => d.name),
    developerSlugs: game.developers.map((d) => d.slug),
    publisherIds: game.publishers.map((p) => p.id),
    publisherNames: game.publishers.map((p) => p.name),
    publisherSlugs: game.publishers.map((p) => p.slug),
    genreIds: game.genres.map((g) => g.id),
    genreNames: game.genres.map((g) => g.name),
    genreSlugs: game.genres.map((g) => g.slug),
    platformIds: game.platforms.map((pl) => pl.id),
    platformNames: game.platforms.map((pl) => pl.name),
    platformSlugs: game.platforms.map((pl) => pl.slug),
    themeIds: game.themes.map((t) => t.id),
    themeNames: game.themes.map((t) => t.name),
    themeSlugs: game.themes.map((t) => t.slug),
    createdAt: toUnixSeconds(game.createdAt),
    updatedAt: game.updatedAt ? toUnixSeconds(game.updatedAt) : undefined,
  };
}

function zipRelation(
  ids: string[] | undefined,
  names: string[] | undefined,
  slugs: string[] | undefined
) {
  const safeIds = ids ?? [];
  const safeNames = names ?? [];
  const safeSlugs = slugs ?? [];
  return safeNames.map((name, idx) => ({
    id: safeIds[idx] ?? "",
    name,
    slug: safeSlugs[idx] ?? "",
  }));
}

export function gameWithRelationsFromDoc(doc: GameDoc): GameWithRelations {
  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    originalTitle: doc.originalTitle ?? null,
    description: doc.description ?? null,
    coverImageUrl: doc.coverImageUrl ?? null,
    releaseDate: doc.releaseDate ?? null,
    metacriticScore: doc.metacriticScore ?? null,
    openCriticScore: doc.openCriticScore ?? null,
    criticScore: doc.criticScore ?? null,
    criticScoreCount: doc.criticScoreCount ?? null,
    popularityScore: doc.popularityScore != null && doc.popularityScore >= 0 ? doc.popularityScore : null,
    hltbMainHours: doc.hltbMainHours ?? null,
    hltbMainExtraHours: doc.hltbMainExtraHours ?? null,
    hltbCompletionistHours: doc.hltbCompletionistHours ?? null,
    createdAt: new Date(doc.createdAt * 1000),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt * 1000) : null,
    developers: zipRelation(doc.developerIds, doc.developerNames, doc.developerSlugs),
    publishers: zipRelation(doc.publisherIds, doc.publisherNames, doc.publisherSlugs),
    genres: zipRelation(doc.genreIds, doc.genreNames, doc.genreSlugs),
    platforms: zipRelation(doc.platformIds, doc.platformNames, doc.platformSlugs),
    themes: zipRelation(doc.themeIds, doc.themeNames, doc.themeSlugs),
  } as unknown as GameWithRelations;
}

export function gameCardFromDoc(doc: GameDoc): GameCard {
  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    coverImageUrl: doc.coverImageUrl ?? null,
    releaseDate: doc.releaseDate ?? null,
    metacriticScore: doc.metacriticScore ?? null,
    openCriticScore: doc.openCriticScore ?? null,
    criticScore: doc.criticScore ?? null,
    criticScoreCount: doc.criticScoreCount ?? null,
    popularityScore: doc.popularityScore != null && Number.isFinite(doc.popularityScore) && doc.popularityScore >= 0 && doc.popularityScore <= 1 ? doc.popularityScore : null,
    hltbMainHours: doc.hltbMainHours ?? null,
    hltbMainExtraHours: doc.hltbMainExtraHours ?? null,
    hltbCompletionistHours: doc.hltbCompletionistHours ?? null,
  };
}
