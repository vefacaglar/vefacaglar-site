import type { TypesenseConfig } from "./typesense.client";

export const TYPESENSE_CLIENT = Symbol("TypesenseClient");
export const TYPESENSE_CONFIG = Symbol("TypesenseConfig");
export const REDIS_CLIENT = Symbol("RedisClient");
export const SEARCH_INDEXER = Symbol("SearchIndexer");

export type { TypesenseConfig };
