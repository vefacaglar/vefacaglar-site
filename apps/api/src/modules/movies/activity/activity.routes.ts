import type { FastifyInstance } from "fastify";
import { container } from "../../../container";
import { ErrorResponseSchema } from "../../../shared/error-schema";
import { GetMovieActivityHandler } from "./get/get.handler";
import { CreateMovieWatchHandler } from "./create/create.handler";
import { UpdateMovieWatchHandler } from "./update/update.handler";
import { DeleteMovieWatchHandler } from "./delete/delete.handler";
import { SetMovieRatingHandler } from "./rating/rating.handler";
import { GetMovieLibraryHandler } from "../library/library.handler";
import { GetMovieStatsHandler } from "../dashboard/stats/stats.handler";
import { MovieStatsSchema } from "../dashboard/stats/stats.schema";
import { MovieLibraryParamsSchema, MovieLibrarySchema, type MovieLibraryParams } from "../library/library.schema";
import { MovieActivityParamsSchema, MovieWatchParamsSchema, MovieActivityQuerySchema, MovieActivitySchema, CreateMovieWatchBodySchema, WatchDateBodySchema, MovieWatchSchema, MovieRatingBodySchema,
  type MovieActivityParams, type MovieWatchParams, type MovieActivityQuery, type CreateMovieWatchBody, type WatchDateBody, type MovieRatingBody } from "./activity.schema";
export async function movieActivityRoutes(app: FastifyInstance) {
  const get = container.resolve(GetMovieActivityHandler), create = container.resolve(CreateMovieWatchHandler),
    update = container.resolve(UpdateMovieWatchHandler), remove = container.resolve(DeleteMovieWatchHandler),
    rating = container.resolve(SetMovieRatingHandler), library = container.resolve(GetMovieLibraryHandler), stats = container.resolve(GetMovieStatsHandler);
  const errors = { 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema };
  app.get("/dashboard/stats", { preHandler: app.requireAdmin, schema: { tags: ["Movies dashboard"], description: "Count public hydrated films in PostgreSQL", response: { 200: MovieStatsSchema, 401: ErrorResponseSchema, 403: ErrorResponseSchema } } }, () => stats.handle());
  app.get<{ Params: MovieLibraryParams }>("/users/:username/library", { preHandler: app.tryAuth, schema: { tags: ["Movies"], description: "A visible profile's movie watches and current ratings", params: MovieLibraryParamsSchema, response: { 200: MovieLibrarySchema, 401: ErrorResponseSchema, 403: ErrorResponseSchema, 404: ErrorResponseSchema } } }, (request) => library.handle(request));
  app.get<{ Params: MovieActivityParams; Querystring: MovieActivityQuery }>("/:slug/activity", { preHandler: app.requireAuth, schema: { tags: ["Movies"], description: "Your movie rating and paginated watch history", params: MovieActivityParamsSchema, querystring: MovieActivityQuerySchema, response: { 200: MovieActivitySchema, ...errors } } }, (request) => get.handle(request));
  app.post<{ Params: MovieActivityParams; Body: CreateMovieWatchBody }>("/:slug/watches", { preHandler: app.requireAuth, schema: { tags: ["Movies"], description: "Log a watch; reuse its UUID to retry the same addition", params: MovieActivityParamsSchema, body: CreateMovieWatchBodySchema, response: { 201: MovieWatchSchema, ...errors, 409: ErrorResponseSchema } } }, async (request, reply) => reply.code(201).send(await create.handle(request)));
  app.put<{ Params: MovieWatchParams; Body: WatchDateBody }>("/:slug/watches/:id", { preHandler: app.requireAuth, schema: { tags: ["Movies"], description: "Edit the date of your watch", params: MovieWatchParamsSchema, body: WatchDateBodySchema, response: { 200: MovieWatchSchema, ...errors } } }, (request) => update.handle(request));
  app.delete<{ Params: MovieWatchParams }>("/:slug/watches/:id", { preHandler: app.requireAuth, schema: { tags: ["Movies"], description: "Delete your watch without changing your rating", params: MovieWatchParamsSchema, response: errors } }, async (request, reply) => { await remove.handle(request); return reply.code(204).send(); });
  app.put<{ Params: MovieActivityParams; Body: MovieRatingBody }>("/:slug/rating", { preHandler: app.requireAuth, schema: { tags: ["Movies"], description: "Save your one 1–10 rating, or clear it with null", params: MovieActivityParamsSchema, body: MovieRatingBodySchema, response: { 200: MovieRatingBodySchema, ...errors } } }, (request) => rating.handle(request));
}
