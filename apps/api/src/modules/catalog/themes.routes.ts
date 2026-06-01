import { FastifyInstance } from "fastify";
import { container } from "../../container";
import { CreateThemeHandler } from "./themes/create/create.handler";
import {
  CreateThemeRequest,
  CreateThemeRequestSchema,
  ThemeResponseSchema,
} from "./themes/create/create.schema";
import { ListThemesHandler } from "./themes/list/list.handler";
import {
  ListThemesQuery,
  ListThemesQuerySchema,
  ListThemesResponseSchema,
} from "./themes/list/list.schema";
import { GetThemeHandler } from "./themes/detail/detail.handler";
import { GetThemeParams, GetThemeParamsSchema } from "./themes/detail/detail.schema";
import { UpdateThemeHandler } from "./themes/update/update.handler";
import {
  UpdateThemeParams,
  UpdateThemeParamsSchema,
  UpdateThemeRequest,
  UpdateThemeRequestSchema,
} from "./themes/update/update.schema";
import { DeleteThemeHandler } from "./themes/delete/delete.handler";
import {
  DeleteThemeParams,
  DeleteThemeParamsSchema,
  DeleteThemeResponseSchema,
} from "./themes/delete/delete.schema";
import { ErrorResponseSchema } from "../../shared/error-schema";

export async function themesRoutes(app: FastifyInstance) {
  const createThemeHandler = container.resolve(CreateThemeHandler);
  const listThemesHandler = container.resolve(ListThemesHandler);
  const getThemeHandler = container.resolve(GetThemeHandler);
  const updateThemeHandler = container.resolve(UpdateThemeHandler);
  const deleteThemeHandler = container.resolve(DeleteThemeHandler);

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
        401: ErrorResponseSchema,
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
        401: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
      },
    },
  }, (request) => deleteThemeHandler.handle(request));
}
