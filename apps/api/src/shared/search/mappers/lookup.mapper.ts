import type { Developer } from "../../../modules/games/developers.repository.interface";
import type { Publisher } from "../../../modules/games/publishers.repository.interface";
import type { Genre } from "../../../modules/games/genres.repository.interface";
import type { Platform } from "../../../modules/games/platforms.repository.interface";
import type { Theme } from "../../../modules/games/themes.repository.interface";

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

function toUnixSeconds(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const d = value instanceof Date ? value : new Date(value);
  return Math.floor(d.getTime() / 1000);
}

export function toDeveloperDoc(row: Developer): DeveloperDoc {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    countryCode: row.countryCode ?? undefined,
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: row.updatedAt ? toUnixSeconds(row.updatedAt) : undefined,
  };
}

export function toPublisherDoc(row: Publisher): PublisherDoc {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    countryCode: row.countryCode ?? undefined,
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: row.updatedAt ? toUnixSeconds(row.updatedAt) : undefined,
  };
}

export function toGenreDoc(row: Genre): GenreDoc {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: row.updatedAt ? toUnixSeconds(row.updatedAt) : undefined,
  };
}

export function toPlatformDoc(row: Platform): PlatformDoc {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: row.updatedAt ? toUnixSeconds(row.updatedAt) : undefined,
  };
}

export function toThemeDoc(row: Theme): ThemeDoc {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: toUnixSeconds(row.createdAt),
    updatedAt: row.updatedAt ? toUnixSeconds(row.updatedAt) : undefined,
  };
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
