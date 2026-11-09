import type { FastifyInstance } from "fastify";
import { container } from "../../../container";
import { ErrorResponseSchema } from "../../../shared/error-schema";
import { GetMovieStatsHandler } from "./stats/stats.handler";
import { MovieStatsSchema } from "./stats/stats.schema";
import { ListDashboardMoviesHandler } from "./list/list.handler";
import { ListDashboardMoviesQuerySchema, ListDashboardMoviesResponseSchema, type ListDashboardMoviesQuery } from "./list/list.schema";
import { SetMoviePosterBlockHandler } from "./poster-block/poster-block.handler";
import { MoviePosterBlockBodySchema, MoviePosterBlockParamsSchema, MoviePosterBlockSchema, type MoviePosterBlockBody, type MoviePosterBlockParams } from "./poster-block/poster-block.schema";
export async function movieDashboardRoutes(app: FastifyInstance) {
  const stats = container.resolve(GetMovieStatsHandler), list = container.resolve(ListDashboardMoviesHandler), posterBlock = container.resolve(SetMoviePosterBlockHandler);
  const adminErrors = { 401: ErrorResponseSchema, 403: ErrorResponseSchema };
  app.get("/dashboard/stats", { preHandler: app.requireAdmin, schema: { tags: ["Movies dashboard"], description: "Movie catalog and poster counts in PostgreSQL", response: { 200: MovieStatsSchema, ...adminErrors } } }, () => stats.handle());
  app.get<{ Querystring: ListDashboardMoviesQuery }>("/dashboard/movies", { preHandler: app.requireAdmin, schema: { tags: ["Movies dashboard"], description: "Search titled catalog movies with their stored poster and block state", querystring: ListDashboardMoviesQuerySchema, response: { 200: ListDashboardMoviesResponseSchema, 400: ErrorResponseSchema, ...adminErrors } } }, (request) => list.handle(request));
  app.put<{ Params: MoviePosterBlockParams; Body: MoviePosterBlockBody }>("/dashboard/movies/:id/poster-block", { preHandler: app.requireAdmin, schema: { tags: ["Movies dashboard"], description: "Block or unblock a movie's poster; a blocked poster and its credit never appear publicly", params: MoviePosterBlockParamsSchema, body: MoviePosterBlockBodySchema, response: { 200: MoviePosterBlockSchema, 400: ErrorResponseSchema, ...adminErrors, 404: ErrorResponseSchema } } }, (request) => posterBlock.handle(request));
}
