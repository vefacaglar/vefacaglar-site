import { FastifyInstance } from "fastify";
import { container } from "../../container";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { ListGamesHandler } from "./list/list.handler";
import { GetLibraryHandler } from "./library/library.handler";
import { LibraryResponseSchema } from "./library/library.schema";
import { GetPublicLibraryHandler } from "./public-library/public-library.handler";
import { PublicLibraryParams, PublicLibraryParamsSchema, PublicLibraryResponseSchema } from "./public-library/public-library.schema";
import { ListGamesQuery, ListGamesQuerySchema, ListGamesResponseSchema } from "./list/list.schema";
import { GetGameHandler } from "./detail/detail.handler";
import { GameDetailResponseSchema, GetGameParams, GetGameParamsSchema } from "./detail/detail.schema";
import { ListGameLogsHandler } from "./logs/list/list.handler";
import { ListGameLogsParams, ListGameLogsParamsSchema, ListGameLogsResponseSchema } from "./logs/list/list.schema";
import { CreateGameLogHandler } from "./logs/create/create.handler";
import { CreateGameLogParams, CreateGameLogParamsSchema, GameLogBody, GameLogBodySchema, GameLogSchema } from "./logs/create/create.schema";
import { GetGameLogHandler } from "./logs/detail/detail.handler";
import { GameLogDetailResponseSchema } from "./logs/detail/detail.schema";
import { UpdateGameLogHandler } from "./logs/update/update.handler";
import { GameLogIdParams, GameLogIdParamsSchema } from "./logs/update/update.schema";
import { DeleteGameLogHandler } from "./logs/delete/delete.handler";
import { DeleteGameLogResponseSchema } from "./logs/delete/delete.schema";
import { GetDeveloperGamesHandler } from "./developers/detail/detail.handler";
import { DeveloperParams, DeveloperParamsSchema, DeveloperQuery, DeveloperQuerySchema, DeveloperResponseSchema } from "./developers/detail/detail.schema";
import { GetPublisherGamesHandler } from "./publishers/detail/detail.handler";
import { PublisherParams, PublisherParamsSchema, PublisherQuery, PublisherQuerySchema, PublisherResponseSchema } from "./publishers/detail/detail.schema";
import { GetGameCommunityHandler } from "./community/community.handler";
import { GameCommunityParamsSchema, GameCommunityQuerySchema, GameCommunitySchema, type GameCommunityParams, type GameCommunityQuery } from "./community/community.schema";

/** Public games pages: catalog browsing plus the signed-in user's own play logs. */
export async function publicGamesRoutes(app: FastifyInstance) {
  const listHandler = container.resolve(ListGamesHandler);
  const getHandler = container.resolve(GetGameHandler);
  const libraryHandler = container.resolve(GetLibraryHandler);
  const publicLibraryHandler = container.resolve(GetPublicLibraryHandler);
  const listLogsHandler = container.resolve(ListGameLogsHandler);
  const createLogHandler = container.resolve(CreateGameLogHandler);
  const getLogHandler = container.resolve(GetGameLogHandler);
  const updateLogHandler = container.resolve(UpdateGameLogHandler);
  const deleteLogHandler = container.resolve(DeleteGameLogHandler);
  const developerHandler = container.resolve(GetDeveloperGamesHandler);
  const publisherHandler = container.resolve(GetPublisherGamesHandler);
  const communityHandler = container.resolve(GetGameCommunityHandler);

  app.get<{ Querystring: ListGamesQuery }>("/", {
    schema: {
      description: "List or search games",
      tags: ["Games"],
      querystring: ListGamesQuerySchema,
      response: { 200: ListGamesResponseSchema },
    },
  }, (request) => listHandler.handle(request));

  app.get<{ Params: DeveloperParams; Querystring: DeveloperQuery }>("/developers/:slug", {
    schema: {
      description: "A developer and its games in this catalog",
      tags: ["Games"],
      params: DeveloperParamsSchema,
      querystring: DeveloperQuerySchema,
      response: { 200: DeveloperResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => developerHandler.handle(request));

  app.get<{ Params: PublisherParams; Querystring: PublisherQuery }>("/publishers/:slug", {
    schema: {
      description: "A publisher and its games in this catalog",
      tags: ["Games"],
      params: PublisherParamsSchema,
      querystring: PublisherQuerySchema,
      response: { 200: PublisherResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => publisherHandler.handle(request));

  app.get("/me/library", {
    preHandler: app.requireAuth,
    schema: {
      description: "The signed-in user's logged games and play stats",
      tags: ["Games"],
      security: [{ bearerAuth: [] }],
      response: { 200: LibraryResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => libraryHandler.handle(request));

  app.get<{ Params: PublicLibraryParams }>("/users/:username/library", {
    preHandler: app.tryAuth,
    schema: {
      description:
        "A user's games library and play stats. 404 if the user is missing or inactive; a private profile " +
        "is 401 for anonymous visitors, 403 for other signed-in users, and visible to its owner.",
      tags: ["Games"],
      // Optional auth: anonymous works, a bearer token lets owners see their private library.
      security: [{}, { bearerAuth: [] }],
      params: PublicLibraryParamsSchema,
      response: {
        200: PublicLibraryResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => publicLibraryHandler.handle(request));

  app.get<{ Params: GameCommunityParams; Querystring: GameCommunityQuery }>("/:slug/community", {
    schema: {
      description: "Site ratings and explicitly shared logs from active public profiles",
      tags: ["Games"], params: GameCommunityParamsSchema, querystring: GameCommunityQuerySchema,
      response: { 200: GameCommunitySchema, 404: ErrorResponseSchema },
    },
  }, (request) => communityHandler.handle(request));

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

  app.get<{ Params: GameLogIdParams }>("/logs/:id", {
    preHandler: app.requireAuth,
    schema: {
      description: "Get one of the signed-in user's game logs with its game",
      tags: ["Games"],
      security: [{ bearerAuth: [] }],
      params: GameLogIdParamsSchema,
      response: { 200: GameLogDetailResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getLogHandler.handle(request));

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
