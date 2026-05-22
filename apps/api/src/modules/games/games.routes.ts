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
import { ErrorResponseSchema } from "../../shared/error-schema";
import { container } from "../../container";

export async function gamesRoutes(app: FastifyInstance) {
  const createDeveloperHandler = container.resolve(CreateDeveloperHandler);
  const listDevelopersHandler = container.resolve(ListDevelopersHandler);
  const getDeveloperHandler = container.resolve(GetDeveloperHandler);
  const updateDeveloperHandler = container.resolve(UpdateDeveloperHandler);
  const deleteDeveloperHandler = container.resolve(DeleteDeveloperHandler);

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
}
