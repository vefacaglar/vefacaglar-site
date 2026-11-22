import type { FastifyInstance } from "fastify";
import { container } from "../../container";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { ListTvSeriesHandler } from "./list/list.handler";
import { ListTvSeriesQuerySchema, ListTvSeriesResponseSchema, type ListTvSeriesQuery } from "./list/list.schema";
import { GetTvSeriesHandler } from "./detail/detail.handler";
import { GetTvSeriesParamsSchema, TvSeriesDetailSchema, type GetTvSeriesParams } from "./detail/detail.schema";
import { GetTvSeasonHandler } from "./season/season.handler";
import { GetTvSeasonParamsSchema, TvSeasonDetailSchema, type GetTvSeasonParams } from "./season/season.schema";
import { tvPreferencesRoutes } from "./preferences/preferences.routes";
export async function tvSeriesRoutes(app: FastifyInstance) {
  await app.register(tvPreferencesRoutes);
  await app.register(tvSeriesPublicRoutes);
}
async function tvSeriesPublicRoutes(app: FastifyInstance) {
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Link", '<https://www.tvmaze.com>; rel="author", <https://creativecommons.org/licenses/by-sa/4.0/>; rel="license"');
    return payload;
  });
  const list = container.resolve(ListTvSeriesHandler);
  const detail = container.resolve(GetTvSeriesHandler);
  const season = container.resolve(GetTvSeasonHandler);
  app.get<{ Querystring: ListTvSeriesQuery }>("/", { schema: {
    tags: ["TV Series"], description: "Browse TV series and search their titles", querystring: ListTvSeriesQuerySchema,
    response: { 200: ListTvSeriesResponseSchema },
  } }, (request) => list.handle(request));
  app.get<{ Params: GetTvSeriesParams }>("/:id", { schema: {
    tags: ["TV Series"], description: "TV series details and seasons", params: GetTvSeriesParamsSchema,
    response: { 200: TvSeriesDetailSchema, 404: ErrorResponseSchema },
  } }, (request) => detail.handle(request));
  app.get<{ Params: GetTvSeasonParams }>("/:id/seasons/:seasonId", { schema: {
    tags: ["TV Series"], description: "A TV season and its episodes", params: GetTvSeasonParamsSchema,
    response: { 200: TvSeasonDetailSchema, 404: ErrorResponseSchema },
  } }, (request) => season.handle(request));
}
