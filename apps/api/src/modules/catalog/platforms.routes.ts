import { FastifyInstance } from "fastify";
import { container } from "../../container";
import { CreatePlatformHandler } from "./platforms/create/create.handler";
import {
  CreatePlatformRequest,
  CreatePlatformRequestSchema,
  PlatformResponseSchema,
} from "./platforms/create/create.schema";
import { ListPlatformsHandler } from "./platforms/list/list.handler";
import {
  ListPlatformsQuery,
  ListPlatformsQuerySchema,
  ListPlatformsResponseSchema,
} from "./platforms/list/list.schema";
import { GetPlatformHandler } from "./platforms/detail/detail.handler";
import { GetPlatformParams, GetPlatformParamsSchema } from "./platforms/detail/detail.schema";
import { UpdatePlatformHandler } from "./platforms/update/update.handler";
import {
  UpdatePlatformParams,
  UpdatePlatformParamsSchema,
  UpdatePlatformRequest,
  UpdatePlatformRequestSchema,
} from "./platforms/update/update.schema";
import { DeletePlatformHandler } from "./platforms/delete/delete.handler";
import {
  DeletePlatformParams,
  DeletePlatformParamsSchema,
  DeletePlatformResponseSchema,
} from "./platforms/delete/delete.schema";
import { ErrorResponseSchema } from "../../shared/error-schema";

export async function platformsRoutes(app: FastifyInstance) {
  const createPlatformHandler = container.resolve(CreatePlatformHandler);
  const listPlatformsHandler = container.resolve(ListPlatformsHandler);
  const getPlatformHandler = container.resolve(GetPlatformHandler);
  const updatePlatformHandler = container.resolve(UpdatePlatformHandler);
  const deletePlatformHandler = container.resolve(DeletePlatformHandler);

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
        401: ErrorResponseSchema,
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
        401: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
      },
    },
  }, (request) => deletePlatformHandler.handle(request));
}
