import type { FastifyInstance } from "fastify";
import { container } from "../../container";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { ListMoviesHandler } from "./list/list.handler";
import { ListMoviesQuerySchema, ListMoviesResponseSchema, type ListMoviesQuery } from "./list/list.schema";
import { GetMovieHandler } from "./detail/detail.handler";
import { GetMovieParamsSchema, MovieDetailSchema, type GetMovieParams } from "./detail/detail.schema";
import { GetMoviePersonHandler } from "./people/detail/detail.handler";
import { GetMoviePersonParamsSchema, GetMoviePersonQuerySchema, MoviePersonPageSchema,
  type GetMoviePersonParams, type GetMoviePersonQuery } from "./people/detail/detail.schema";
import { movieActivityRoutes } from "./activity/activity.routes";
export async function moviesRoutes(app: FastifyInstance) {
  await movieActivityRoutes(app);
  const list = container.resolve(ListMoviesHandler);
  const detail = container.resolve(GetMovieHandler);
  const person = container.resolve(GetMoviePersonHandler);
  app.get<{ Querystring: ListMoviesQuery }>("/", { schema: { tags: ["Movies"], description: "Browse the hydrated Wikidata film catalog", querystring: ListMoviesQuerySchema, response: { 200: ListMoviesResponseSchema } } }, (request) => list.handle(request));
  app.get<{ Params: GetMoviePersonParams; Querystring: GetMoviePersonQuery }>("/people/:wikidataId", {
    schema: { tags: ["Movies"], description: "A credited person's films available in this catalog", params: GetMoviePersonParamsSchema,
      querystring: GetMoviePersonQuerySchema, response: { 200: MoviePersonPageSchema, 404: ErrorResponseSchema } },
  }, (request) => person.handle(request));
  app.get<{ Params: GetMovieParams }>("/:slug", { schema: { tags: ["Movies"], description: "Movie facts and source credits", params: GetMovieParamsSchema, response: { 200: MovieDetailSchema, 404: ErrorResponseSchema } } }, (request) => detail.handle(request));
}
