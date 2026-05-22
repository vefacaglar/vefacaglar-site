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
}
