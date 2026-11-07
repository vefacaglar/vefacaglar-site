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
  "search.movies.sync": defineJobType({
    description: "Synchronize the public movie index with durable bootstrap, changed-film upserts, deletions, and complete interest ranking publication.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => SEARCH_INDEX_CONCURRENCY_KEY,
  }),
  "catalog.movies.sync": defineJobType({
    description:
      "Synchronize a bounded batch of Wikidata films, cast, filmmakers, and production companies. Durable catalog progress resumes across runs; no provider account is required.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "catalog.movies",
  }),
  "catalog.movies.popularity.refresh": defineJobType({
    description:
      "Refresh movie interest using films appearing among the most-viewed English Wikipedia articles. This is article interest, not film viewership or ratings.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => "catalog.movies.popularity",
  }),
  "catalog.popularity.refresh": defineJobType({
    description:
      "Refresh game popularity from IGDB and optional HowLongToBeat engagement, supplement missing completion hours, and synchronize game search documents. Runs daily and shares the search indexing lock.",
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
