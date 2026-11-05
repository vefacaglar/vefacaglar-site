import type { FastifyInstance } from "fastify";
import { container } from "../../container";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { ListMoviesHandler } from "./list/list.handler";
import { ListMoviesQuerySchema, ListMoviesResponseSchema, type ListMoviesQuery } from "./list/list.schema";
import { GetMovieHandler } from "./detail/detail.handler";
import { GetMovieParamsSchema, MovieDetailSchema, type GetMovieParams } from "./detail/detail.schema";
export async function moviesRoutes(app: FastifyInstance) {
  const list = container.resolve(ListMoviesHandler);
  const detail = container.resolve(GetMovieHandler);
  app.get<{ Querystring: ListMoviesQuery }>("/", { schema: { tags: ["Movies"], description: "Browse the hydrated Wikidata film catalog", querystring: ListMoviesQuerySchema, response: { 200: ListMoviesResponseSchema } } }, (request) => list.handle(request));
  app.get<{ Params: GetMovieParams }>("/:slug", { schema: { tags: ["Movies"], description: "Movie facts and source credits", params: GetMovieParamsSchema, response: { 200: MovieDetailSchema, 404: ErrorResponseSchema } } }, (request) => detail.handle(request));
}
