import type { GameWithRelations } from "../../../modules/games/games.repository.interface";
import type { SearchLanguage } from "../search-indexer.interface";

export type GameTranslations = { field: string; value: string }[];

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

function pickTranslation<T extends string | null | undefined>(
  raw: T,
  translations: GameTranslations,
  field: string
): T {
  if (translations.length === 0) return raw;
  const tr = translations.find((t) => t.field === field);
  return tr ? (tr.value as T) : raw;
}

export function toGameDoc(
  game: GameWithRelations,
  lang: SearchLanguage,
  translations: GameTranslations = []
): GameDoc {
  return {
    id: game.id,
    slug: game.slug,
    title: pickTranslation(game.title, translations, "title"),
    originalTitle: game.originalTitle ?? undefined,
    description: pickTranslation(game.description, translations, "description") ?? undefined,
    coverImageUrl: game.coverImageUrl ?? undefined,
    releaseDate: game.releaseDate ?? undefined,
    metacriticScore: game.metacriticScore ?? undefined,
    openCriticScore: game.openCriticScore ?? undefined,
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
