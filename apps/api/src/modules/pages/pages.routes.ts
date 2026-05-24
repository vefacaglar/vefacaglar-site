import { FastifyInstance } from "fastify";
import { CreatePageHandler } from "./dashboard/create/create.handler";
import { CreatePageRequest, CreatePageRequestSchema, PageResponseSchema } from "./dashboard/create/create.schema";
import { ListPagesHandler } from "./list/list.handler";
import { ListPagesQuery, ListPagesQuerySchema, ListPagesResponseSchema } from "./list/list.schema";
import { ListAdminPagesHandler } from "./dashboard/list/list.handler";
import { ListAdminPagesQuery, ListAdminPagesQuerySchema, ListAdminPagesResponseSchema } from "./dashboard/list/list.schema";
import { GetPageHandler } from "./detail/detail.handler";
import { GetPageParams, GetPageParamsSchema, GetPageResponseSchema } from "./detail/detail.schema";
import { GetAdminPageHandler } from "./dashboard/detail/detail.handler";
import { GetAdminPageParams, GetAdminPageParamsSchema, GetAdminPageResponseSchema } from "./dashboard/detail/detail.schema";
import { UpdatePageHandler } from "./dashboard/update/update.handler";
import { UpdatePageParams, UpdatePageParamsSchema, UpdatePageRequest, UpdatePageRequestSchema, UpdatePageResponseSchema } from "./dashboard/update/update.schema";
import { DeletePageHandler } from "./dashboard/delete/delete.handler";
import { DeletePageParams, DeletePageParamsSchema, DeletePageResponseSchema } from "./dashboard/delete/delete.schema";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { container } from "../../container";

export async function pagesRoutes(app: FastifyInstance) {
  const createHandler = container.resolve(CreatePageHandler);
  const listHandler = container.resolve(ListPagesHandler);
  const listAdminHandler = container.resolve(ListAdminPagesHandler);
  const getHandler = container.resolve(GetPageHandler);
  const getAdminHandler = container.resolve(GetAdminPageHandler);
  const updateHandler = container.resolve(UpdatePageHandler);
  const deleteHandler = container.resolve(DeletePageHandler);

  app.post<{ Body: CreatePageRequest }>("/dashboard", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new page",
      tags: ["Pages"],
      security: [{ bearerAuth: [] }],
      body: CreatePageRequestSchema,
      response: { 200: PageResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => createHandler.handle(request));

  app.get<{ Querystring: ListPagesQuery }>("/", {
    schema: {
      description: "List pages",
      tags: ["Pages"],
      querystring: ListPagesQuerySchema,
      response: { 200: ListPagesResponseSchema },
    },
  }, (request) => listHandler.handle(request));

  app.get<{ Querystring: ListAdminPagesQuery }>("/dashboard", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List raw pages for dashboard",
      tags: ["Pages"],
      security: [{ bearerAuth: [] }],
      querystring: ListAdminPagesQuerySchema,
      response: { 200: ListAdminPagesResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => listAdminHandler.handle(request));

  app.get<{ Params: GetAdminPageParams }>("/dashboard/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get raw page by id for dashboard editing",
      tags: ["Pages"],
      security: [{ bearerAuth: [] }],
      params: GetAdminPageParamsSchema,
      response: { 200: GetAdminPageResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getAdminHandler.handle(request));

  app.get<{ Params: GetPageParams }>("/:slug", {
    schema: {
      description: "Get page by slug",
      tags: ["Pages"],
      params: GetPageParamsSchema,
      response: { 200: GetPageResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getHandler.handle(request));

  app.put<{ Params: UpdatePageParams; Body: UpdatePageRequest }>("/dashboard/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update an existing page",
      tags: ["Pages"],
      security: [{ bearerAuth: [] }],
      params: UpdatePageParamsSchema,
      body: UpdatePageRequestSchema,
      response: { 200: UpdatePageResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => updateHandler.handle(request));

  app.delete<{ Params: DeletePageParams }>("/dashboard/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a page",
      tags: ["Pages"],
      security: [{ bearerAuth: [] }],
      params: DeletePageParamsSchema,
      response: { 200: DeletePageResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => deleteHandler.handle(request));
}
