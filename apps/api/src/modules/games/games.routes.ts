import { FastifyInstance } from "fastify";
import { CreateDeveloperHandler } from "./developers/create/create.handler";
import { CreateDeveloperRequest, CreateDeveloperRequestSchema, DeveloperResponseSchema } from "./developers/create/create.schema";
import { ListDevelopersHandler } from "./developers/list/list.handler";
import { ListDevelopersQuery, ListDevelopersQuerySchema, ListDevelopersResponseSchema } from "./developers/list/list.schema";
import { GetDeveloperHandler } from "./developers/detail/detail.handler";
import { GetDeveloperParams, GetDeveloperParamsSchema } from "./developers/detail/detail.schema";
import { UpdateDeveloperHandler } from "./developers/update/update.handler";
import { UpdateDeveloperParams, UpdateDeveloperParamsSchema, UpdateDeveloperRequest, UpdateDeveloperRequestSchema } from "./developers/update/update.schema";
import { DeleteDeveloperHandler } from "./developers/delete/delete.handler";
import { DeleteDeveloperParams, DeleteDeveloperParamsSchema, DeleteDeveloperResponseSchema } from "./developers/delete/delete.schema";

import { CreatePublisherHandler } from "./publishers/create/create.handler";
import { CreatePublisherRequest, CreatePublisherRequestSchema, PublisherResponseSchema } from "./publishers/create/create.schema";
import { ListPublishersHandler } from "./publishers/list/list.handler";
import { ListPublishersQuery, ListPublishersQuerySchema, ListPublishersResponseSchema } from "./publishers/list/list.schema";
import { GetPublisherHandler } from "./publishers/detail/detail.handler";
import { GetPublisherParams, GetPublisherParamsSchema } from "./publishers/detail/detail.schema";
import { UpdatePublisherHandler } from "./publishers/update/update.handler";
import { UpdatePublisherParams, UpdatePublisherParamsSchema, UpdatePublisherRequest, UpdatePublisherRequestSchema } from "./publishers/update/update.schema";
import { DeletePublisherHandler } from "./publishers/delete/delete.handler";
import { DeletePublisherParams, DeletePublisherParamsSchema, DeletePublisherResponseSchema } from "./publishers/delete/delete.schema";

import { CreateGenreHandler } from "./genres/create/create.handler";
import { CreateGenreRequest, CreateGenreRequestSchema, GenreResponseSchema } from "./genres/create/create.schema";
import { ListGenresHandler } from "./genres/list/list.handler";
import { ListGenresQuery, ListGenresQuerySchema, ListGenresResponseSchema } from "./genres/list/list.schema";
import { GetGenreHandler } from "./genres/detail/detail.handler";
import { GetGenreParams, GetGenreParamsSchema } from "./genres/detail/detail.schema";
import { UpdateGenreHandler } from "./genres/update/update.handler";
import { UpdateGenreParams, UpdateGenreParamsSchema, UpdateGenreRequest, UpdateGenreRequestSchema } from "./genres/update/update.schema";
import { DeleteGenreHandler } from "./genres/delete/delete.handler";
import { DeleteGenreParams, DeleteGenreParamsSchema, DeleteGenreResponseSchema } from "./genres/delete/delete.schema";

import { CreateThemeHandler } from "./themes/create/create.handler";
import { CreateThemeRequest, CreateThemeRequestSchema, ThemeResponseSchema } from "./themes/create/create.schema";
import { ListThemesHandler } from "./themes/list/list.handler";
import { ListThemesQuery, ListThemesQuerySchema, ListThemesResponseSchema } from "./themes/list/list.schema";
import { GetThemeHandler } from "./themes/detail/detail.handler";
import { GetThemeParams, GetThemeParamsSchema } from "./themes/detail/detail.schema";
import { UpdateThemeHandler } from "./themes/update/update.handler";
import { UpdateThemeParams, UpdateThemeParamsSchema, UpdateThemeRequest, UpdateThemeRequestSchema } from "./themes/update/update.schema";
import { DeleteThemeHandler } from "./themes/delete/delete.handler";
import { DeleteThemeParams, DeleteThemeParamsSchema, DeleteThemeResponseSchema } from "./themes/delete/delete.schema";

import { CreatePlatformHandler } from "./platforms/create/create.handler";
import { CreatePlatformRequest, CreatePlatformRequestSchema, PlatformResponseSchema } from "./platforms/create/create.schema";
import { ListPlatformsHandler } from "./platforms/list/list.handler";
import { ListPlatformsQuery, ListPlatformsQuerySchema, ListPlatformsResponseSchema } from "./platforms/list/list.schema";
import { GetPlatformHandler } from "./platforms/detail/detail.handler";
import { GetPlatformParams, GetPlatformParamsSchema } from "./platforms/detail/detail.schema";
import { UpdatePlatformHandler } from "./platforms/update/update.handler";
import { UpdatePlatformParams, UpdatePlatformParamsSchema, UpdatePlatformRequest, UpdatePlatformRequestSchema } from "./platforms/update/update.schema";
import { DeletePlatformHandler } from "./platforms/delete/delete.handler";
import { DeletePlatformParams, DeletePlatformParamsSchema, DeletePlatformResponseSchema } from "./platforms/delete/delete.schema";

import { CreateGameHandler } from "./games/create/create.handler";
import { CreateGameRequest, CreateGameRequestSchema, GameResponseSchema } from "./games/create/create.schema";
import { ListGamesHandler } from "./games/list/list.handler";
import { ListGamesQuery, ListGamesQuerySchema, ListGamesResponseSchema } from "./games/list/list.schema";
import { GetGameHandler } from "./games/detail/detail.handler";
import { GetGameParams, GetGameParamsSchema } from "./games/detail/detail.schema";
import { UpdateGameHandler } from "./games/update/update.handler";
import { UpdateGameParams, UpdateGameParamsSchema, UpdateGameRequest, UpdateGameRequestSchema } from "./games/update/update.schema";
import { DeleteGameHandler } from "./games/delete/delete.handler";
import { DeleteGameParams, DeleteGameParamsSchema, DeleteGameResponseSchema } from "./games/delete/delete.schema";

import { LinkGameDeveloperHandler } from "./games/relations/developers/link.handler";
import { UnlinkGameDeveloperHandler } from "./games/relations/developers/unlink.handler";
import { LinkGamePublisherHandler } from "./games/relations/publishers/link.handler";
import { UnlinkGamePublisherHandler } from "./games/relations/publishers/unlink.handler";
import { LinkGameGenreHandler } from "./games/relations/genres/link.handler";
import { UnlinkGameGenreHandler } from "./games/relations/genres/unlink.handler";
import { LinkGamePlatformHandler } from "./games/relations/platforms/link.handler";
import { UnlinkGamePlatformHandler } from "./games/relations/platforms/unlink.handler";
import { LinkGameThemeHandler } from "./games/relations/themes/link.handler";
import { UnlinkGameThemeHandler } from "./games/relations/themes/unlink.handler";
import {
  LinkDeveloperParams,
  LinkDeveloperParamsSchema,
  LinkPublisherParams,
  LinkPublisherParamsSchema,
  LinkGenreParams,
  LinkGenreParamsSchema,
  LinkPlatformParams,
  LinkPlatformParamsSchema,
  LinkThemeParams,
  LinkThemeParamsSchema,
  RelationMutationResponseSchema,
} from "./games/relations/relation.schemas";


import { ErrorResponseSchema } from "../../shared/error-schema";
import { container } from "../../container";

export async function gamesRoutes(app: FastifyInstance) {
  const createDeveloperHandler = container.resolve(CreateDeveloperHandler);
  const listDevelopersHandler = container.resolve(ListDevelopersHandler);
  const getDeveloperHandler = container.resolve(GetDeveloperHandler);
  const updateDeveloperHandler = container.resolve(UpdateDeveloperHandler);
  const deleteDeveloperHandler = container.resolve(DeleteDeveloperHandler);

  const createPublisherHandler = container.resolve(CreatePublisherHandler);
  const listPublishersHandler = container.resolve(ListPublishersHandler);
  const getPublisherHandler = container.resolve(GetPublisherHandler);
  const updatePublisherHandler = container.resolve(UpdatePublisherHandler);
  const deletePublisherHandler = container.resolve(DeletePublisherHandler);

  const createGenreHandler = container.resolve(CreateGenreHandler);
  const listGenresHandler = container.resolve(ListGenresHandler);
  const getGenreHandler = container.resolve(GetGenreHandler);
  const updateGenreHandler = container.resolve(UpdateGenreHandler);
  const deleteGenreHandler = container.resolve(DeleteGenreHandler);

  const createThemeHandler = container.resolve(CreateThemeHandler);
  const listThemesHandler = container.resolve(ListThemesHandler);
  const getThemeHandler = container.resolve(GetThemeHandler);
  const updateThemeHandler = container.resolve(UpdateThemeHandler);
  const deleteThemeHandler = container.resolve(DeleteThemeHandler);

  const createPlatformHandler = container.resolve(CreatePlatformHandler);
  const listPlatformsHandler = container.resolve(ListPlatformsHandler);
  const getPlatformHandler = container.resolve(GetPlatformHandler);
  const updatePlatformHandler = container.resolve(UpdatePlatformHandler);
  const deletePlatformHandler = container.resolve(DeletePlatformHandler);

  const createGameHandler = container.resolve(CreateGameHandler);
  const listGamesHandler = container.resolve(ListGamesHandler);
  const getGameHandler = container.resolve(GetGameHandler);
  const updateGameHandler = container.resolve(UpdateGameHandler);
  const deleteGameHandler = container.resolve(DeleteGameHandler);

  const linkGameDeveloperHandler = container.resolve(LinkGameDeveloperHandler);
  const unlinkGameDeveloperHandler = container.resolve(UnlinkGameDeveloperHandler);
  const linkGamePublisherHandler = container.resolve(LinkGamePublisherHandler);
  const unlinkGamePublisherHandler = container.resolve(UnlinkGamePublisherHandler);
  const linkGameGenreHandler = container.resolve(LinkGameGenreHandler);
  const unlinkGameGenreHandler = container.resolve(UnlinkGameGenreHandler);
  const linkGamePlatformHandler = container.resolve(LinkGamePlatformHandler);
  const unlinkGamePlatformHandler = container.resolve(UnlinkGamePlatformHandler);
  const linkGameThemeHandler = container.resolve(LinkGameThemeHandler);
  const unlinkGameThemeHandler = container.resolve(UnlinkGameThemeHandler);


  // --- Developer CRUD Routes (Admin only) ---

  app.post<{ Body: CreateDeveloperRequest }>("/developers", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new developer",
      tags: ["Games - Developers"],
      security: [{ bearerAuth: [] }],
      body: CreateDeveloperRequestSchema,
      response: { 
        200: DeveloperResponseSchema, 
        400: ErrorResponseSchema, 
        401: ErrorResponseSchema 
      },
    },
  }, (request) => createDeveloperHandler.handle(request));

  app.get<{ Querystring: ListDevelopersQuery }>("/developers", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List developers for administrative management",
      tags: ["Games - Developers"],
      security: [{ bearerAuth: [] }],
      querystring: ListDevelopersQuerySchema,
      response: { 
        200: ListDevelopersResponseSchema, 
        401: ErrorResponseSchema 
      },
    },
  }, (request) => listDevelopersHandler.handle(request));

  app.get<{ Params: GetDeveloperParams }>("/developers/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get developer details by ID",
      tags: ["Games - Developers"],
      security: [{ bearerAuth: [] }],
      params: GetDeveloperParamsSchema,
      response: { 
        200: DeveloperResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => getDeveloperHandler.handle(request));

  app.put<{ Params: UpdateDeveloperParams; Body: UpdateDeveloperRequest }>("/developers/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update an existing developer by ID",
      tags: ["Games - Developers"],
      security: [{ bearerAuth: [] }],
      params: UpdateDeveloperParamsSchema,
      body: UpdateDeveloperRequestSchema,
      response: { 
        200: DeveloperResponseSchema, 
        400: ErrorResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => updateDeveloperHandler.handle(request));

  app.delete<{ Params: DeleteDeveloperParams }>("/developers/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a developer by ID",
      tags: ["Games - Developers"],
      security: [{ bearerAuth: [] }],
      params: DeleteDeveloperParamsSchema,
      response: { 
        200: DeleteDeveloperResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => deleteDeveloperHandler.handle(request));

  // --- Publisher CRUD Routes (Admin only) ---

  app.post<{ Body: CreatePublisherRequest }>("/publishers", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new publisher",
      tags: ["Games - Publishers"],
      security: [{ bearerAuth: [] }],
      body: CreatePublisherRequestSchema,
      response: { 
        200: PublisherResponseSchema, 
        400: ErrorResponseSchema, 
        401: ErrorResponseSchema 
      },
    },
  }, (request) => createPublisherHandler.handle(request));

  app.get<{ Querystring: ListPublishersQuery }>("/publishers", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List publishers for administrative management",
      tags: ["Games - Publishers"],
      security: [{ bearerAuth: [] }],
      querystring: ListPublishersQuerySchema,
      response: { 
        200: ListPublishersResponseSchema, 
        401: ErrorResponseSchema 
      },
    },
  }, (request) => listPublishersHandler.handle(request));

  app.get<{ Params: GetPublisherParams }>("/publishers/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get publisher details by ID",
      tags: ["Games - Publishers"],
      security: [{ bearerAuth: [] }],
      params: GetPublisherParamsSchema,
      response: { 
        200: PublisherResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => getPublisherHandler.handle(request));

  app.put<{ Params: UpdatePublisherParams; Body: UpdatePublisherRequest }>("/publishers/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update an existing publisher by ID",
      tags: ["Games - Publishers"],
      security: [{ bearerAuth: [] }],
      params: UpdatePublisherParamsSchema,
      body: UpdatePublisherRequestSchema,
      response: { 
        200: PublisherResponseSchema, 
        400: ErrorResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => updatePublisherHandler.handle(request));

  app.delete<{ Params: DeletePublisherParams }>("/publishers/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a publisher by ID",
      tags: ["Games - Publishers"],
      security: [{ bearerAuth: [] }],
      params: DeletePublisherParamsSchema,
      response: { 
        200: DeletePublisherResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => deletePublisherHandler.handle(request));

  // --- Genre CRUD Routes (Admin only) ---

  app.post<{ Body: CreateGenreRequest }>("/genres", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new genre",
      tags: ["Games - Genres"],
      security: [{ bearerAuth: [] }],
      body: CreateGenreRequestSchema,
      response: { 
        200: GenreResponseSchema, 
        400: ErrorResponseSchema, 
        401: ErrorResponseSchema 
      },
    },
  }, (request) => createGenreHandler.handle(request));

  app.get<{ Querystring: ListGenresQuery }>("/genres", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List genres for administrative management",
      tags: ["Games - Genres"],
      security: [{ bearerAuth: [] }],
      querystring: ListGenresQuerySchema,
      response: { 
        200: ListGenresResponseSchema, 
        401: ErrorResponseSchema 
      },
    },
  }, (request) => listGenresHandler.handle(request));

  app.get<{ Params: GetGenreParams }>("/genres/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get genre details by ID",
      tags: ["Games - Genres"],
      security: [{ bearerAuth: [] }],
      params: GetGenreParamsSchema,
      response: { 
        200: GenreResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => getGenreHandler.handle(request));

  app.put<{ Params: UpdateGenreParams; Body: UpdateGenreRequest }>("/genres/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update an existing genre by ID",
      tags: ["Games - Genres"],
      security: [{ bearerAuth: [] }],
      params: UpdateGenreParamsSchema,
      body: UpdateGenreRequestSchema,
      response: { 
        200: GenreResponseSchema, 
        400: ErrorResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => updateGenreHandler.handle(request));

  app.delete<{ Params: DeleteGenreParams }>("/genres/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a genre by ID",
      tags: ["Games - Genres"],
      security: [{ bearerAuth: [] }],
      params: DeleteGenreParamsSchema,
      response: { 
        200: DeleteGenreResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => deleteGenreHandler.handle(request));

  // --- Theme CRUD Routes (Admin only) ---

  app.post<{ Body: CreateThemeRequest }>("/themes", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new theme",
      tags: ["Games - Themes"],
      security: [{ bearerAuth: [] }],
      body: CreateThemeRequestSchema,
      response: { 
        200: ThemeResponseSchema, 
        400: ErrorResponseSchema, 
        401: ErrorResponseSchema 
      },
    },
  }, (request) => createThemeHandler.handle(request));

  app.get<{ Querystring: ListThemesQuery }>("/themes", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List themes for administrative management",
      tags: ["Games - Themes"],
      security: [{ bearerAuth: [] }],
      querystring: ListThemesQuerySchema,
      response: { 
        200: ListThemesResponseSchema, 
        401: ErrorResponseSchema 
      },
    },
  }, (request) => listThemesHandler.handle(request));

  app.get<{ Params: GetThemeParams }>("/themes/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get theme details by ID",
      tags: ["Games - Themes"],
      security: [{ bearerAuth: [] }],
      params: GetThemeParamsSchema,
      response: { 
        200: ThemeResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => getThemeHandler.handle(request));

  app.put<{ Params: UpdateThemeParams; Body: UpdateThemeRequest }>("/themes/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update an existing theme by ID",
      tags: ["Games - Themes"],
      security: [{ bearerAuth: [] }],
      params: UpdateThemeParamsSchema,
      body: UpdateThemeRequestSchema,
      response: { 
        200: ThemeResponseSchema, 
        400: ErrorResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => updateThemeHandler.handle(request));

  app.delete<{ Params: DeleteThemeParams }>("/themes/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a theme by ID",
      tags: ["Games - Themes"],
      security: [{ bearerAuth: [] }],
      params: DeleteThemeParamsSchema,
      response: { 
        200: DeleteThemeResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => deleteThemeHandler.handle(request));

  // --- Platform CRUD Routes (Admin only) ---

  app.post<{ Body: CreatePlatformRequest }>("/platforms", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new platform",
      tags: ["Games - Platforms"],
      security: [{ bearerAuth: [] }],
      body: CreatePlatformRequestSchema,
      response: { 
        200: PlatformResponseSchema, 
        400: ErrorResponseSchema, 
        401: ErrorResponseSchema 
      },
    },
  }, (request) => createPlatformHandler.handle(request));

  app.get<{ Querystring: ListPlatformsQuery }>("/platforms", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List platforms for administrative management",
      tags: ["Games - Platforms"],
      security: [{ bearerAuth: [] }],
      querystring: ListPlatformsQuerySchema,
      response: { 
        200: ListPlatformsResponseSchema, 
        401: ErrorResponseSchema 
      },
    },
  }, (request) => listPlatformsHandler.handle(request));

  app.get<{ Params: GetPlatformParams }>("/platforms/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get platform details by ID",
      tags: ["Games - Platforms"],
      security: [{ bearerAuth: [] }],
      params: GetPlatformParamsSchema,
      response: { 
        200: PlatformResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => getPlatformHandler.handle(request));

  app.put<{ Params: UpdatePlatformParams; Body: UpdatePlatformRequest }>("/platforms/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update an existing platform by ID",
      tags: ["Games - Platforms"],
      security: [{ bearerAuth: [] }],
      params: UpdatePlatformParamsSchema,
      body: UpdatePlatformRequestSchema,
      response: { 
        200: PlatformResponseSchema, 
        400: ErrorResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => updatePlatformHandler.handle(request));

  app.delete<{ Params: DeletePlatformParams }>("/platforms/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a platform by ID",
      tags: ["Games - Platforms"],
      security: [{ bearerAuth: [] }],
      params: DeletePlatformParamsSchema,
      response: { 
        200: DeletePlatformResponseSchema, 
        401: ErrorResponseSchema, 
        404: ErrorResponseSchema 
      },
    },
  }, (request) => deletePlatformHandler.handle(request));

  // --- Game CRUD Routes (Admin only) ---

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
        401: ErrorResponseSchema 
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
        401: ErrorResponseSchema 
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
        404: ErrorResponseSchema 
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
        404: ErrorResponseSchema 
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
        404: ErrorResponseSchema
      },
    },
  }, (request) => deleteGameHandler.handle(request));

  // --- Game Relation Link/Unlink Routes (Admin only) ---

  app.post<{ Params: LinkDeveloperParams }>("/games/:id/developers/:developerId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Link a developer to a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkDeveloperParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => linkGameDeveloperHandler.handle(request));

  app.delete<{ Params: LinkDeveloperParams }>("/games/:id/developers/:developerId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Unlink a developer from a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkDeveloperParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => unlinkGameDeveloperHandler.handle(request));

  app.post<{ Params: LinkPublisherParams }>("/games/:id/publishers/:publisherId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Link a publisher to a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkPublisherParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => linkGamePublisherHandler.handle(request));

  app.delete<{ Params: LinkPublisherParams }>("/games/:id/publishers/:publisherId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Unlink a publisher from a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkPublisherParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => unlinkGamePublisherHandler.handle(request));

  app.post<{ Params: LinkGenreParams }>("/games/:id/genres/:genreId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Link a genre to a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkGenreParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => linkGameGenreHandler.handle(request));

  app.delete<{ Params: LinkGenreParams }>("/games/:id/genres/:genreId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Unlink a genre from a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkGenreParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => unlinkGameGenreHandler.handle(request));

  app.post<{ Params: LinkPlatformParams }>("/games/:id/platforms/:platformId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Link a platform to a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkPlatformParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => linkGamePlatformHandler.handle(request));

  app.delete<{ Params: LinkPlatformParams }>("/games/:id/platforms/:platformId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Unlink a platform from a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkPlatformParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => unlinkGamePlatformHandler.handle(request));

  app.post<{ Params: LinkThemeParams }>("/games/:id/themes/:themeId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Link a theme to a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkThemeParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => linkGameThemeHandler.handle(request));

  app.delete<{ Params: LinkThemeParams }>("/games/:id/themes/:themeId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Unlink a theme from a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkThemeParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => unlinkGameThemeHandler.handle(request));
}
