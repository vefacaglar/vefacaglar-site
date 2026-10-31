import { FastifyInstance } from "fastify";
import { container } from "../../container";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { ListGamesHandler } from "./list/list.handler";
import { ListGamesQuery, ListGamesQuerySchema, ListGamesResponseSchema } from "./list/list.schema";
import { GetGameHandler } from "./detail/detail.handler";
import { GameDetailResponseSchema, GetGameParams, GetGameParamsSchema } from "./detail/detail.schema";
import { ListGameLogsHandler } from "./logs/list/list.handler";
import { ListGameLogsParams, ListGameLogsParamsSchema, ListGameLogsResponseSchema } from "./logs/list/list.schema";
import { CreateGameLogHandler } from "./logs/create/create.handler";
import { CreateGameLogParams, CreateGameLogParamsSchema, GameLogBody, GameLogBodySchema, GameLogSchema } from "./logs/create/create.schema";
import { UpdateGameLogHandler } from "./logs/update/update.handler";
import { GameLogIdParams, GameLogIdParamsSchema } from "./logs/update/update.schema";
import { DeleteGameLogHandler } from "./logs/delete/delete.handler";
import { DeleteGameLogResponseSchema } from "./logs/delete/delete.schema";

/** Public games pages: catalog browsing plus the signed-in user's own play logs. */
export async function publicGamesRoutes(app: FastifyInstance) {
  const listHandler = container.resolve(ListGamesHandler);
  const getHandler = container.resolve(GetGameHandler);
  const listLogsHandler = container.resolve(ListGameLogsHandler);
  const createLogHandler = container.resolve(CreateGameLogHandler);
  const updateLogHandler = container.resolve(UpdateGameLogHandler);
  const deleteLogHandler = container.resolve(DeleteGameLogHandler);

  app.get<{ Querystring: ListGamesQuery }>("/", {
    schema: {
      description: "List or search games",
      tags: ["Games"],
      querystring: ListGamesQuerySchema,
      response: { 200: ListGamesResponseSchema },
    },
  }, (request) => listHandler.handle(request));

  app.get<{ Params: GetGameParams }>("/:slug", {
    schema: {
      description: "Get a game by slug",
      tags: ["Games"],
      params: GetGameParamsSchema,
      response: { 200: GameDetailResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getHandler.handle(request));

  app.get<{ Params: ListGameLogsParams }>("/:slug/logs", {
    preHandler: app.requireAuth,
    schema: {
      description: "List the signed-in user's logs for a game",
      tags: ["Games"],
      security: [{ bearerAuth: [] }],
      params: ListGameLogsParamsSchema,
      response: { 200: ListGameLogsResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => listLogsHandler.handle(request));

  app.post<{ Params: CreateGameLogParams; Body: GameLogBody }>("/:slug/logs", {
    preHandler: app.requireAuth,
    schema: {
      description: "Log a game for the signed-in user",
      tags: ["Games"],
      security: [{ bearerAuth: [] }],
      params: CreateGameLogParamsSchema,
      body: GameLogBodySchema,
      response: { 200: GameLogSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => createLogHandler.handle(request));

  app.put<{ Params: GameLogIdParams; Body: GameLogBody }>("/logs/:id", {
    preHandler: app.requireAuth,
    schema: {
      description: "Update one of the signed-in user's game logs",
      tags: ["Games"],
      security: [{ bearerAuth: [] }],
      params: GameLogIdParamsSchema,
      body: GameLogBodySchema,
      response: { 200: GameLogSchema, 400: ErrorResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => updateLogHandler.handle(request));

  app.delete<{ Params: GameLogIdParams }>("/logs/:id", {
    preHandler: app.requireAuth,
    schema: {
      description: "Delete one of the signed-in user's game logs",
      tags: ["Games"],
      security: [{ bearerAuth: [] }],
      params: GameLogIdParamsSchema,
      response: { 200: DeleteGameLogResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => deleteLogHandler.handle(request));
}
