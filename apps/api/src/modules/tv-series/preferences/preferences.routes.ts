import type { FastifyInstance } from "fastify";
import { Value } from "@sinclair/typebox/value";
import { BadRequestError } from "../../../shared/http-errors";
import { container } from "../../../container";
import { ErrorResponseSchema } from "../../../shared/error-schema";
import { GetTvPreferencesHandler } from "./get/get.handler";
import { SetTvRatingHandler } from "./rating/rating.handler";
import { SetTvNoteHandler } from "./note/note.handler";
import { TvPreferenceParamsSchema, TvPreferencesSchema, TvRatingBodySchema, TvNoteBodySchema,
  type TvPreferenceParams, type TvRatingBody, type TvNoteBody } from "./preferences.schema";
export async function tvPreferencesRoutes(app: FastifyInstance) {
  const get = container.resolve(GetTvPreferencesHandler);
  const rating = container.resolve(SetTvRatingHandler);
  const note = container.resolve(SetTvNoteHandler);
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "private, no-store");
    reply.header("Vary", "Authorization");
    return payload;
  });
  const errors = { 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema, 409: ErrorResponseSchema };
  app.get<{ Params: TvPreferenceParams }>("/:id/preferences", {
    preHandler: app.requireAuth, schema: { tags: ["TV Series"], description: "Your private rating and personal note",
      params: TvPreferenceParamsSchema, response: { 200: TvPreferencesSchema, ...errors } },
  }, (request) => get.handle(request));
  app.put<{ Params: TvPreferenceParams; Body: TvRatingBody }>("/:id/preferences/rating", {
    // Check the original JSON before AJV can coerce 0 or an empty string to null.
    preValidation: async (request) => { if (!Value.Check(TvRatingBodySchema, request.body)) throw new BadRequestError("err_tv_rating"); },
    preHandler: app.requireAuth, schema: { tags: ["TV Series"], description: "Save or clear your 1–10 rating without changing your note",
      params: TvPreferenceParamsSchema, body: TvRatingBodySchema, response: { 200: TvPreferencesSchema, ...errors } },
  }, (request) => rating.handle(request));
  app.put<{ Params: TvPreferenceParams; Body: TvNoteBody }>("/:id/preferences/note", {
    preValidation: async (request) => { if (!Value.Check(TvNoteBodySchema, request.body)) throw new BadRequestError("err_tv_note_length"); },
    preHandler: app.requireAuth, schema: { tags: ["TV Series"], description: "Save or clear your private personal note without changing your rating",
      params: TvPreferenceParamsSchema, body: TvNoteBodySchema, response: { 200: TvPreferencesSchema, ...errors } },
  }, (request) => note.handle(request));
}
