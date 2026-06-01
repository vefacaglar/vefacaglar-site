import type { TypesenseConfig } from "./typesense.client";

export const TYPESENSE_CLIENT = Symbol("TypesenseClient");
export const TYPESENSE_CONFIG = Symbol("TypesenseConfig");
export const REDIS_CLIENT = Symbol("RedisClient");

/** Query side (CQRS read model) — injected into list handlers. */
export const SEARCH_READER = Symbol("SearchReader");
/** Command side (write model maintenance) — injected into the event subscriber and reindex script. */
export const SEARCH_WRITER = Symbol("SearchIndexWriter");

export type { TypesenseConfig };
