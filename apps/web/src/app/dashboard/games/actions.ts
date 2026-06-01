"use server";

import { authedRequest, authedMutation } from "../../../lib/apiAction";

const REVALIDATE_GAMES = ["/dashboard/games"];

// --- Developers ---

export async function createDeveloperAction(data: {
  name: string;
  slug: string;
  countryCode?: string;
}) {
  return authedMutation("POST", "/api/catalog/developers", {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Could not create developer.",
  });
}

export async function updateDeveloperAction(
  id: string,
  data: { name?: string; slug?: string; countryCode?: string | null }
) {
  return authedMutation("PUT", `/api/catalog/developers/${id}`, {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to update developer.",
  });
}

export async function deleteDeveloperAction(id: string) {
  return authedMutation("DELETE", `/api/catalog/developers/${id}`, {
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to delete developer.",
  });
}

// --- Publishers ---

export async function createPublisherAction(data: {
  name: string;
  slug: string;
  countryCode?: string;
}) {
  return authedMutation("POST", "/api/catalog/publishers", {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Could not create publisher.",
  });
}

export async function updatePublisherAction(
  id: string,
  data: { name?: string; slug?: string; countryCode?: string | null }
) {
  return authedMutation("PUT", `/api/catalog/publishers/${id}`, {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to update publisher.",
  });
}

export async function deletePublisherAction(id: string) {
  return authedMutation("DELETE", `/api/catalog/publishers/${id}`, {
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to delete publisher.",
  });
}

// --- Genres ---

export async function createGenreAction(data: { name: string; slug: string }) {
  return authedMutation("POST", "/api/catalog/genres", {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Could not create genre.",
  });
}

export async function updateGenreAction(id: string, data: { name?: string; slug?: string }) {
  return authedMutation("PUT", `/api/catalog/genres/${id}`, {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to update genre.",
  });
}

export async function deleteGenreAction(id: string) {
  return authedMutation("DELETE", `/api/catalog/genres/${id}`, {
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to delete genre.",
  });
}

// --- Themes ---

export async function createThemeAction(data: { name: string; slug: string }) {
  return authedMutation("POST", "/api/catalog/themes", {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Could not create theme.",
  });
}

export async function updateThemeAction(id: string, data: { name?: string; slug?: string }) {
  return authedMutation("PUT", `/api/catalog/themes/${id}`, {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to update theme.",
  });
}

export async function deleteThemeAction(id: string) {
  return authedMutation("DELETE", `/api/catalog/themes/${id}`, {
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to delete theme.",
  });
}

// --- Platforms ---

export async function createPlatformAction(data: { name: string; slug: string }) {
  return authedMutation("POST", "/api/catalog/platforms", {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Could not create platform.",
  });
}

export async function updatePlatformAction(id: string, data: { name?: string; slug?: string }) {
  return authedMutation("PUT", `/api/catalog/platforms/${id}`, {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to update platform.",
  });
}

export async function deletePlatformAction(id: string) {
  return authedMutation("DELETE", `/api/catalog/platforms/${id}`, {
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to delete platform.",
  });
}

// --- Games ---

export async function createGameAction(data: {
  title: string;
  slug: string;
  originalTitle?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  releaseDate?: string | null;
  metacriticScore?: number | null;
  openCriticScore?: number | null;
  hltbMainHours?: string | number | null;
  hltbMainExtraHours?: string | number | null;
  hltbCompletionistHours?: string | number | null;
  developerIds?: string[];
  publisherIds?: string[];
  genreIds?: string[];
  platformIds?: string[];
  themeIds?: string[];
}) {
  return authedMutation("POST", "/api/catalog/games", {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Could not create game.",
  });
}

export async function updateGameAction(
  id: string,
  data: {
    title?: string;
    slug?: string;
    originalTitle?: string | null;
    description?: string | null;
    coverImageUrl?: string | null;
    releaseDate?: string | null;
    metacriticScore?: number | null;
    openCriticScore?: number | null;
    hltbMainHours?: string | number | null;
    hltbMainExtraHours?: string | number | null;
    hltbCompletionistHours?: string | number | null;
  }
) {
  return authedMutation("PUT", `/api/catalog/games/${id}`, {
    body: data,
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to update game.",
  });
}

export async function deleteGameAction(id: string) {
  return authedMutation("DELETE", `/api/catalog/games/${id}`, {
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to delete game.",
  });
}

// --- Game relation link/unlink ---

type RelationType = "developers" | "publishers" | "genres" | "platforms" | "themes";

export async function linkGameRelationAction(gameId: string, relationType: RelationType, relationId: string) {
  return authedMutation("POST", `/api/catalog/games/${gameId}/${relationType}/${relationId}`, {
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to link relation.",
  });
}

export async function unlinkGameRelationAction(gameId: string, relationType: RelationType, relationId: string) {
  return authedMutation("DELETE", `/api/catalog/games/${gameId}/${relationType}/${relationId}`, {
    revalidate: REVALIDATE_GAMES,
    fallbackError: "Failed to unlink relation.",
  });
}

// --- List / detail proxies (server-side paginated/searched fetch) ---

type ListParams = { page?: number; limit?: number; q?: string };
type ListResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

async function listProxy<T>(path: string, params: ListParams): Promise<ListResult<T> | { error: string }> {
  const search = new URLSearchParams();
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.q && params.q.trim()) search.set("q", params.q.trim());
  const qs = search.toString();
  const url = qs ? `${path}?${qs}` : path;

  const res = await authedRequest<ListResult<T>>("GET", url, { fallbackError: "Failed to fetch list." });
  if ("error" in res) return res;
  return res.data;
}

async function getProxy<T>(path: string): Promise<T | { error: string }> {
  const res = await authedRequest<T>("GET", path, { fallbackError: "Failed to fetch." });
  if ("error" in res) return res;
  return res.data;
}

export async function listGamesAction(params: ListParams) {
  return listProxy("/api/catalog/games", params);
}
export async function listDevelopersAction(params: ListParams) {
  return listProxy("/api/catalog/developers", params);
}
export async function listPublishersAction(params: ListParams) {
  return listProxy("/api/catalog/publishers", params);
}
export async function listGenresAction(params: ListParams) {
  return listProxy("/api/catalog/genres", params);
}
export async function listThemesAction(params: ListParams) {
  return listProxy("/api/catalog/themes", params);
}
export async function listPlatformsAction(params: ListParams) {
  return listProxy("/api/catalog/platforms", params);
}
export async function getGameAction(id: string) {
  return getProxy<unknown>(`/api/catalog/games/${id}`);
}
export async function listRelationsOptionsAction() {
  return getProxy<{
    genres: { id: string; name: string; slug: string }[];
    themes: { id: string; name: string; slug: string }[];
    platforms: { id: string; name: string; slug: string }[];
  }>("/api/catalog/relations-options");
}
