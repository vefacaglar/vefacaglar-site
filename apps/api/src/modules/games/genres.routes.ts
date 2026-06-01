import { FastifyInstance } from "fastify";
import { container } from "../../container";
import { CreateGenreHandler } from "./genres/create/create.handler";
import {
  CreateGenreRequest,
  CreateGenreRequestSchema,
  GenreResponseSchema,
} from "./genres/create/create.schema";
import { ListGenresHandler } from "./genres/list/list.handler";
import {
  ListGenresQuery,
  ListGenresQuerySchema,
  ListGenresResponseSchema,
} from "./genres/list/list.schema";
import { GetGenreHandler } from "./genres/detail/detail.handler";
import { GetGenreParams, GetGenreParamsSchema } from "./genres/detail/detail.schema";
import { UpdateGenreHandler } from "./genres/update/update.handler";
import {
  UpdateGenreParams,
  UpdateGenreParamsSchema,
  UpdateGenreRequest,
  UpdateGenreRequestSchema,
} from "./genres/update/update.schema";
import { DeleteGenreHandler } from "./genres/delete/delete.handler";
import {
  DeleteGenreParams,
  DeleteGenreParamsSchema,
  DeleteGenreResponseSchema,
} from "./genres/delete/delete.schema";
import { ErrorResponseSchema } from "../../shared/error-schema";

export async function genresRoutes(app: FastifyInstance) {
  const createGenreHandler = container.resolve(CreateGenreHandler);
  const listGenresHandler = container.resolve(ListGenresHandler);
  const getGenreHandler = container.resolve(GetGenreHandler);
  const updateGenreHandler = container.resolve(UpdateGenreHandler);
  const deleteGenreHandler = container.resolve(DeleteGenreHandler);

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
        401: ErrorResponseSchema,
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
        401: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
      },
    },
  }, (request) => deleteGenreHandler.handle(request));
}
