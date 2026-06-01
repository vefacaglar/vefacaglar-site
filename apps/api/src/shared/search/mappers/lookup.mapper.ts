import type { Developer } from "../../../modules/games/developers.repository.interface";
import type { Publisher } from "../../../modules/games/publishers.repository.interface";
import type { Genre } from "../../../modules/games/genres.repository.interface";
import type { Platform } from "../../../modules/games/platforms.repository.interface";
import type { Theme } from "../../../modules/games/themes.repository.interface";
import type { SearchLanguage } from "../search-indexer.interface";

export interface DeveloperDoc {
  id: string;
  name: string;
  slug: string;
  countryCode?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface PublisherDoc {
  id: string;
  name: string;
  slug: string;
  countryCode?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface GenreDoc {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
  updatedAt?: number;
}

export interface PlatformDoc {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
  updatedAt?: number;
}

export interface ThemeDoc {
  id: string;
  name: string;
  slug: string;
  createdAt: number;
  updatedAt?: number;
}

export type LookupDoc =
  | DeveloperDoc
  | PublisherDoc
  | GenreDoc
  | PlatformDoc
  | ThemeDoc;

function toUnixSeconds(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const d = value instanceof Date ? value : new Date(value);
  return Math.floor(d.getTime() / 1000);
}

function applyNameTranslation(
  raw: string,
  translations: { field: string; value: string }[]
): string {
  const tr = translations.find((t) => t.field === "name");
  return tr ? tr.value : raw;
}

function applyNameTranslationOptional(
  raw: string | null | undefined,
  translations: { field: string; value: string }[]
): string | undefined {
  const tr = translations.find((t) => t.field === "name");
  if (tr) return tr.value;
  return raw ?? undefined;
}

export function toDeveloperDoc(
  row: Developer,
  lang: SearchLanguage,
  translations: { field: string; value: string }[] = []
): DeveloperDoc {
  const base: DeveloperDoc = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    countryCode: row.countryCode ?? undefined,
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: row.updatedAt ? toUnixSeconds(row.updatedAt) : undefined,
  };
  if (lang === "en" || translations.length === 0) return base;
  return { ...base, name: applyNameTranslation(base.name, translations) };
}

export function toPublisherDoc(
  row: Publisher,
  lang: SearchLanguage,
  translations: { field: string; value: string }[] = []
): PublisherDoc {
  const base: PublisherDoc = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    countryCode: row.countryCode ?? undefined,
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: row.updatedAt ? toUnixSeconds(row.updatedAt) : undefined,
  };
  if (lang === "en" || translations.length === 0) return base;
  return { ...base, name: applyNameTranslation(base.name, translations) };
}

export function toGenreDoc(
  row: Genre,
  lang: SearchLanguage,
  translations: { field: string; value: string }[] = []
): GenreDoc {
  const base: GenreDoc = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: row.updatedAt ? toUnixSeconds(row.updatedAt) : undefined,
  };
  if (lang === "en" || translations.length === 0) return base;
  return { ...base, name: applyNameTranslation(base.name, translations) };
}

export function toPlatformDoc(
  row: Platform,
  lang: SearchLanguage,
  translations: { field: string; value: string }[] = []
): PlatformDoc {
  const base: PlatformDoc = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: row.updatedAt ? toUnixSeconds(row.updatedAt) : undefined,
  };
  if (lang === "en" || translations.length === 0) return base;
  return { ...base, name: applyNameTranslation(base.name, translations) };
}

export function toThemeDoc(
  row: Theme,
  lang: SearchLanguage,
  translations: { field: string; value: string }[] = []
): ThemeDoc {
  const base: ThemeDoc = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: row.updatedAt ? toUnixSeconds(row.updatedAt) : undefined,
  };
  if (lang === "en" || translations.length === 0) return base;
  return { ...base, name: applyNameTranslation(base.name, translations) };
}

export function developerFromDoc(doc: DeveloperDoc): Developer {
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    countryCode: doc.countryCode ?? null,
    createdAt: new Date(doc.createdAt * 1000),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt * 1000) : null,
  } as Developer;
}

export function publisherFromDoc(doc: PublisherDoc): Publisher {
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    countryCode: doc.countryCode ?? null,
    createdAt: new Date(doc.createdAt * 1000),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt * 1000) : null,
  } as Publisher;
}

export function genreFromDoc(doc: GenreDoc): Genre {
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    createdAt: new Date(doc.createdAt * 1000),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt * 1000) : null,
  } as Genre;
}

export function platformFromDoc(doc: PlatformDoc): Platform {
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    createdAt: new Date(doc.createdAt * 1000),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt * 1000) : null,
  } as Platform;
}

export function themeFromDoc(doc: ThemeDoc): Theme {
  return {
    id: doc.id,
    name: doc.name,
    slug: doc.slug,
    createdAt: new Date(doc.createdAt * 1000),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt * 1000) : null,
  } as Theme;
}
