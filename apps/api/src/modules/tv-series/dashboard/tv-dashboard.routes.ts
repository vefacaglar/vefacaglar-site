import type { FastifyInstance } from "fastify";
import { container } from "../../../container";
import { ErrorResponseSchema } from "../../../shared/error-schema";
import { GetTvDashboardStatsHandler } from "./stats/stats.handler";
import { TvDashboardStatsSchema } from "./stats/stats.schema";
import { ListDashboardTvHandler } from "./list/list.handler";
import { ListDashboardTvQuerySchema, ListDashboardTvResponseSchema, type ListDashboardTvQuery } from "./list/list.schema";

export async function tvDashboardRoutes(app: FastifyInstance) {
  const stats = container.resolve(GetTvDashboardStatsHandler);
  const list = container.resolve(ListDashboardTvHandler);
  const errors = { 401: ErrorResponseSchema, 403: ErrorResponseSchema };
  app.get("/dashboard/stats", { preHandler: app.requireAdmin, schema: { tags: ["TV Series dashboard"], description: "TV catalog import totals", response: { 200: TvDashboardStatsSchema, ...errors } } }, () => stats.handle());
  app.get<{ Querystring: ListDashboardTvQuery }>("/dashboard/series", { preHandler: app.requireAdmin, schema: { tags: ["TV Series dashboard"], description: "Search TV catalog records and their import status", querystring: ListDashboardTvQuerySchema, response: { 200: ListDashboardTvResponseSchema, 400: ErrorResponseSchema, ...errors } } }, (request) => list.handle(request));
}
