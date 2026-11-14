import type { FastifyInstance } from "fastify";
import { container } from "../../container";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { ListMoviesHandler } from "./list/list.handler";
import { ListMoviesQuerySchema, ListMoviesResponseSchema, type ListMoviesQuery } from "./list/list.schema";
import { GetMovieHandler } from "./detail/detail.handler";
import { GetMovieParamsSchema, MovieDetailSchema, type GetMovieParams } from "./detail/detail.schema";
import { GetMoviePersonHandler } from "./people/detail/detail.handler";
import { GetMoviePersonParamsSchema, MoviePersonPageSchema,
  type GetMoviePersonParams } from "./people/detail/detail.schema";
import { SuggestMoviesHandler } from "./suggest/suggest.handler";
import { MovieSuggestQuerySchema, MovieSuggestResponseSchema, type MovieSuggestQuery } from "./suggest/suggest.schema";
import { SearchMoviePeopleHandler } from "./people/search/search.handler";
import { SearchMoviePeopleQuerySchema, SearchMoviePeopleResponseSchema, type SearchMoviePeopleQuery } from "./people/search/search.schema";
import { movieActivityRoutes } from "./activity/activity.routes";
import { movieDashboardRoutes } from "./dashboard/movies-dashboard.routes";
import { GetMovieCommunityHandler } from "./community/community.handler";
import { MovieCommunityParamsSchema, MovieCommunityQuerySchema, MovieCommunitySchema, type MovieCommunityParams, type MovieCommunityQuery } from "./community/community.schema";
export async function moviesRoutes(app: FastifyInstance) {
  await movieActivityRoutes(app);
  await movieDashboardRoutes(app);
  const list = container.resolve(ListMoviesHandler);
  const detail = container.resolve(GetMovieHandler);
  const person = container.resolve(GetMoviePersonHandler);
  const community = container.resolve(GetMovieCommunityHandler);
  const suggest = container.resolve(SuggestMoviesHandler);
  const peopleSearch = container.resolve(SearchMoviePeopleHandler);
  app.get<{ Querystring: ListMoviesQuery }>("/", { schema: { tags: ["Movies"], description: "Browse the hydrated Wikidata film catalog", querystring: ListMoviesQuerySchema, response: { 200: ListMoviesResponseSchema } } }, (request) => list.handle(request));
  // Static paths are registered before "/:slug" for readability; the router also prefers static segments.
  app.get<{ Querystring: MovieSuggestQuery }>("/suggest", { schema: { tags: ["Movies"], description: "Search-box suggestions: matching titles and credited people",
    querystring: MovieSuggestQuerySchema, response: { 200: MovieSuggestResponseSchema } } }, (request) => suggest.handle(request));
  app.get<{ Querystring: SearchMoviePeopleQuery }>("/people", { schema: { tags: ["Movies"], description: "Credited people matching a catalog search",
    querystring: SearchMoviePeopleQuerySchema, response: { 200: SearchMoviePeopleResponseSchema } } }, (request) => peopleSearch.handle(request));
  app.get<{ Params: GetMoviePersonParams }>("/people/:wikidataId", {
    schema: { tags: ["Movies"], description: "A credited person's films in this catalog, newest release year first", params: GetMoviePersonParamsSchema,
      response: { 200: MoviePersonPageSchema, 404: ErrorResponseSchema } },
  }, (request) => person.handle(request));
  app.get<{ Params: MovieCommunityParams; Querystring: MovieCommunityQuery }>("/:slug/community", {
    schema: { tags: ["Movies"], description: "Site ratings and explicitly shared watches from active public profiles", params: MovieCommunityParamsSchema, querystring: MovieCommunityQuerySchema,
      response: { 200: MovieCommunitySchema, 404: ErrorResponseSchema } },
  }, (request) => community.handle(request));
  app.get<{ Params: GetMovieParams }>("/:slug", { schema: { tags: ["Movies"], description: "Movie facts and source credits", params: GetMovieParamsSchema, response: { 200: MovieDetailSchema, 404: ErrorResponseSchema } } }, (request) => detail.handle(request));
}
