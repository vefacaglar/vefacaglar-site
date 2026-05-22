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
}
