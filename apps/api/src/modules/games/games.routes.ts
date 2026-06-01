import { FastifyInstance } from "fastify";
import { container } from "../../container";
import { CreateGameHandler } from "./games/create/create.handler";
import {
  CreateGameRequest,
  CreateGameRequestSchema,
  GameResponseSchema,
} from "./games/create/create.schema";
import { ListGamesHandler } from "./games/list/list.handler";
import {
  ListGamesQuery,
  ListGamesQuerySchema,
  ListGamesResponseSchema,
} from "./games/list/list.schema";
import { GetGameHandler } from "./games/detail/detail.handler";
import { GetGameParams, GetGameParamsSchema } from "./games/detail/detail.schema";
import { UpdateGameHandler } from "./games/update/update.handler";
import {
  UpdateGameParams,
  UpdateGameParamsSchema,
  UpdateGameRequest,
  UpdateGameRequestSchema,
} from "./games/update/update.schema";
import { DeleteGameHandler } from "./games/delete/delete.handler";
import {
  DeleteGameParams,
  DeleteGameParamsSchema,
  DeleteGameResponseSchema,
} from "./games/delete/delete.schema";
import { RelationsOptionsHandler } from "./options/options.handler";
import { RelationsOptionsResponseSchema } from "./options/options.schema";
import { ErrorResponseSchema } from "../../shared/error-schema";

export async function gamesRoutes(app: FastifyInstance) {
  const createGameHandler = container.resolve(CreateGameHandler);
  const listGamesHandler = container.resolve(ListGamesHandler);
  const getGameHandler = container.resolve(GetGameHandler);
  const updateGameHandler = container.resolve(UpdateGameHandler);
  const deleteGameHandler = container.resolve(DeleteGameHandler);
  const relationsOptionsHandler = container.resolve(RelationsOptionsHandler);

  app.post<{ Body: CreateGameRequest }>("/games", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new game",
      tags: ["Games - Catalog"],
      security: [{ bearerAuth: [] }],
      body: CreateGameRequestSchema,
      response: {
        200: GameResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, (request) => createGameHandler.handle(request));

  app.get<{ Querystring: ListGamesQuery }>("/games", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List games for administrative management",
      tags: ["Games - Catalog"],
      security: [{ bearerAuth: [] }],
      querystring: ListGamesQuerySchema,
      response: {
        200: ListGamesResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, (request) => listGamesHandler.handle(request));

  app.get<{ Params: GetGameParams }>("/games/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get game details by ID",
      tags: ["Games - Catalog"],
      security: [{ bearerAuth: [] }],
      params: GetGameParamsSchema,
      response: {
        200: GameResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => getGameHandler.handle(request));

  app.put<{ Params: UpdateGameParams; Body: UpdateGameRequest }>("/games/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update an existing game by ID",
      tags: ["Games - Catalog"],
      security: [{ bearerAuth: [] }],
      params: UpdateGameParamsSchema,
      body: UpdateGameRequestSchema,
      response: {
        200: GameResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => updateGameHandler.handle(request));

  app.delete<{ Params: DeleteGameParams }>("/games/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a game by ID",
      tags: ["Games - Catalog"],
      security: [{ bearerAuth: [] }],
      params: DeleteGameParamsSchema,
      response: {
        200: DeleteGameResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => deleteGameHandler.handle(request));

  app.get("/relations-options", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List all relation options (genres, themes, platforms) for catalog management",
      tags: ["Games - Catalog"],
      security: [{ bearerAuth: [] }],
      response: {
        200: RelationsOptionsResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, (request) => relationsOptionsHandler.handle(request));
}
