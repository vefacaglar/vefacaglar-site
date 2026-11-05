import type { FastifyInstance } from "fastify";
import { container } from "../../../container";
import { ErrorResponseSchema } from "../../../shared/error-schema";
import { HltbParamsSchema, type HltbParams } from "./hltb.schema";
import { HltbApplyBodySchema, HltbApplyResponseSchema, type HltbApplyBody } from "./apply/apply.schema";
import { HltbLookupBodySchema, HltbLookupResponseSchema, type HltbLookupBody } from "./lookup/lookup.schema";
import { LookupHltbHandler } from "./lookup/lookup.handler";
import { ApplyHltbHandler } from "./apply/apply.handler";
import { RetryHltbSyncHandler } from "./retry-sync/retry-sync.handler";
export async function hltbRoutes(app: FastifyInstance) {
  const lookup = container.resolve(LookupHltbHandler);
  const apply = container.resolve(ApplyHltbHandler);
  const retry = container.resolve(RetryHltbSyncHandler);
  const common = { tags: ["Games - Catalog"], security: [{ bearerAuth: [] }], params: HltbParamsSchema };
  const errors = { 400: ErrorResponseSchema, 401: ErrorResponseSchema, 403: ErrorResponseSchema, 404: ErrorResponseSchema, 409: ErrorResponseSchema };
  app.post<{ Params: HltbParams; Body: HltbLookupBody }>("/games/:id/hltb/lookup", { preHandler: app.requireAdmin, schema: { ...common, description: "Search HowLongToBeat candidates for explicit review", body: HltbLookupBodySchema, response: { 200: HltbLookupResponseSchema, ...errors } } }, (request) => lookup.handle(request));
  app.post<{ Params: HltbParams; Body: HltbApplyBody }>("/games/:id/hltb/apply", { preHandler: app.requireAdmin, schema: { ...common, description: "Apply a verified HowLongToBeat candidate", body: HltbApplyBodySchema, response: { 200: HltbApplyResponseSchema, ...errors } } }, (request) => apply.handle(request));
  app.post<{ Params: HltbParams }>("/games/:id/hltb/retry-sync", { preHandler: app.requireAdmin, schema: { ...common, description: "Retry a saved game's pending search update", response: { 200: HltbApplyResponseSchema, ...errors } } }, (request) => retry.handle(request));
}
