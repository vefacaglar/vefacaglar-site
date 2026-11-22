import { Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { BadRequestError } from "../../shared/http-errors";

/**
 * Allowlist of job types the API may enqueue. Every type needs a matching
 * handler registered in the Rust worker (apps/worker); see docs/jobs-worker.md.
 */
interface JobTypeDefinition<S extends TSchema = TSchema> {
  /** Static, English description shown in the dashboard. */
  description: string;
  payloadSchema: S;
  /** At most one queued/running job may exist per key; `null` = unlimited. */
  concurrencyKey: (payload: Static<S>) => string | null;
}

function defineJobType<S extends TSchema>(definition: JobTypeDefinition<S>): JobTypeDefinition<S> {
  return definition;
}

/** Live popularity writes must not overlap full reindex alias swaps or search sync. */
const SEARCH_INDEX_CONCURRENCY_KEY = "search.index";

const EmptyPayloadSchema = Type.Object({}, { additionalProperties: false });

export const JOB_TYPES = {
  "catalog.games.completion_times.refresh": defineJobType({
    description: "Refresh official IGDB completion times and independent Backloggd, IFDB and VNDB reports with verified game identities, per-source caches and robust finish-time estimates. Runs daily.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "catalog.games.completion_times",
  }),
  "catalog.games.import": defineJobType({
    description: "Collect the IGDB game catalog in ascending ID order, resuming durable progress after interruptions. Runs every six hours for up to 330 minutes.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "catalog.games.import",
  }),
  "search.reindex": defineJobType({
    description:
      "Full search reindex: builds new timestamped collections for games, catalog facets, and posts (movies have a dedicated sync), loads all documents, then swaps all aliases at once and deletes the old collections.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => SEARCH_INDEX_CONCURRENCY_KEY,
  }),
  "search.sync": defineJobType({
    description:
      "Search sync: adds documents that exist in the database but are missing from the live game, catalog facet, and post search collections. Movies have a dedicated sync.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => SEARCH_INDEX_CONCURRENCY_KEY,
  }),
  "catalog.tv-series.cast.refresh": defineJobType({
    description: "Refresh official TVmaze main cast and verified shared actor identities in fair bounded batches; retain previous snapshots on provider failure.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "catalog.tv-series.cast",
  }),
  "catalog.tv-series.sync": defineJobType({
    description: "Synchronize the TVmaze TV catalog, seasons and episodes in bounded resumable batches. Ratings are provided by TVmaze.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "catalog.tv-series",
  }),
  "catalog.tv-series.popularity.refresh": defineJobType({
    description: "Refresh current TV popularity from complete TMDB daily snapshots and recent Wikipedia top-page interest using verified TVmaze identities.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "catalog.tv-series.popularity",
  }),
  "search.tv-series.sync": defineJobType({
    description: "Publish the dedicated TV series search index from canonical catalog and complete current popularity snapshots.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "search.tv-series.index",
  }),
  "search.movies.sync": defineJobType({
    description: "Synchronize the public movie index with durable bootstrap, changed-film upserts, deletions, and complete interest ranking publication.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "search.movies.index",
  }),
  "catalog.movies.sync": defineJobType({
    description:
      "Synchronize a bounded batch of Wikidata films, cast, filmmakers, and production companies. Durable catalog progress resumes across runs; no provider account is required.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "catalog.movies",
  }),
  "catalog.movies.popularity.refresh": defineJobType({
    description:
      "Refresh current movie popularity from TMDB daily popularity exports, Netflix weekly global film views and recent Wikipedia interest. Each run reports source dates, coverage and retained-source failures.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "catalog.movies.popularity",
  }),
  "catalog.movies.english_titles": defineJobType({
    description:
      "Replace stored non-English movie titles with the English Wikidata label (en, en-gb, en-us, en-ca, mul) in bounded, resumable batches. Slugs never change; a full pass repeats at most every 30 days.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "catalog.movies.english_titles",
  }),
  "catalog.popularity.refresh": defineJobType({
    description:
      "Refresh game popularity and owner recommendations from IGDB signals and game modes, and synchronize game search documents. Runs daily and shares the search indexing lock.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => SEARCH_INDEX_CONCURRENCY_KEY,
  }),
} satisfies Record<string, JobTypeDefinition<any>>;

export type JobType = keyof typeof JOB_TYPES;

/** Description of a job type, or `null` for a type that is not (or no longer) allowlisted. */
export function describeJobType(type: string): string | null {
  return isKnownJobType(type) ? JOB_TYPES[type].description : null;
}

export function isKnownJobType(type: string): type is JobType {
  return Object.prototype.hasOwnProperty.call(JOB_TYPES, type);
}

/**
 * Validates `payload` against the type's schema and derives its concurrency key.
 * Throws `BadRequestError` for an unknown type or an invalid payload.
 */
export function prepareJob(
  type: string,
  payload: unknown
): { type: JobType; payload: Record<string, unknown>; concurrencyKey: string | null } {
  if (!isKnownJobType(type)) {
    throw new BadRequestError("err_job_unknown_type");
  }
  const definition: JobTypeDefinition<any> = JOB_TYPES[type];
  const value = payload ?? {};
  if (!Value.Check(definition.payloadSchema, value)) {
    throw new BadRequestError("err_job_invalid_payload");
  }
  return {
    type,
    payload: value as Record<string, unknown>,
    concurrencyKey: definition.concurrencyKey(value),
  };
}
