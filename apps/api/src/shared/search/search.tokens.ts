import type { MeilisearchConfig } from "./meilisearch.client";

/** Meilisearch HTTP client (`ISearchClient`). */
export const SEARCH_CLIENT = Symbol("SearchClient");
export const MEILISEARCH_CONFIG = Symbol("MeilisearchConfig");

/** Query side (CQRS read model) — injected into list handlers. */
export const SEARCH_READER = Symbol("SearchReader");
/** Command side (write model maintenance) — injected into the event subscriber. */
export const SEARCH_WRITER = Symbol("SearchIndexWriter");

export type { MeilisearchConfig };
