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

/** `search.reindex` and `search.sync` must never run at the same time. */
const SEARCH_INDEX_CONCURRENCY_KEY = "search.index";

const EmptyPayloadSchema = Type.Object({}, { additionalProperties: false });

export const JOB_TYPES = {
  "search.reindex": defineJobType({
    description:
      "Full search reindex: builds new timestamped collections for every index, loads all documents, then swaps all aliases at once and deletes the old collections.",
    payloadSchema: EmptyPayloadSchema,
    concurrencyKey: () => SEARCH_INDEX_CONCURRENCY_KEY,
  }),
  "search.sync": defineJobType({
    description:
      "Search sync: adds documents that exist in the database but are missing from the live search collections.",
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
