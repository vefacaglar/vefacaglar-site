import { FastifyInstance } from "fastify";
import { container } from "../../container";
import { CreatePublisherHandler } from "./publishers/create/create.handler";
import {
  CreatePublisherRequest,
  CreatePublisherRequestSchema,
  PublisherResponseSchema,
} from "./publishers/create/create.schema";
import { ListPublishersHandler } from "./publishers/list/list.handler";
import {
  ListPublishersQuery,
  ListPublishersQuerySchema,
  ListPublishersResponseSchema,
} from "./publishers/list/list.schema";
import { GetPublisherHandler } from "./publishers/detail/detail.handler";
import { GetPublisherParams, GetPublisherParamsSchema } from "./publishers/detail/detail.schema";
import { UpdatePublisherHandler } from "./publishers/update/update.handler";
import {
  UpdatePublisherParams,
  UpdatePublisherParamsSchema,
  UpdatePublisherRequest,
  UpdatePublisherRequestSchema,
} from "./publishers/update/update.schema";
import { DeletePublisherHandler } from "./publishers/delete/delete.handler";
import {
  DeletePublisherParams,
  DeletePublisherParamsSchema,
  DeletePublisherResponseSchema,
} from "./publishers/delete/delete.schema";
import { ErrorResponseSchema } from "../../shared/error-schema";

export async function publishersRoutes(app: FastifyInstance) {
  const createPublisherHandler = container.resolve(CreatePublisherHandler);
  const listPublishersHandler = container.resolve(ListPublishersHandler);
  const getPublisherHandler = container.resolve(GetPublisherHandler);
  const updatePublisherHandler = container.resolve(UpdatePublisherHandler);
  const deletePublisherHandler = container.resolve(DeletePublisherHandler);

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
        401: ErrorResponseSchema,
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
        401: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
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
        404: ErrorResponseSchema,
      },
    },
  }, (request) => deletePublisherHandler.handle(request));
}
