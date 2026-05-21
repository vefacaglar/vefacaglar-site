import { FastifyInstance } from "fastify";
import { CreatePageHandler } from "./create/create.handler";
import { CreatePageRequest, CreatePageRequestSchema, PageResponseSchema } from "./create/create.schema";
import { ListPagesHandler } from "./list/list.handler";
import { ListPagesQuery, ListPagesQuerySchema, ListPagesResponseSchema } from "./list/list.schema";
import { GetPageHandler } from "./detail/detail.handler";
import { GetPageParams, GetPageParamsSchema, GetPageResponseSchema } from "./detail/detail.schema";
import { UpdatePageHandler } from "./update/update.handler";
import { UpdatePageParams, UpdatePageParamsSchema, UpdatePageRequest, UpdatePageRequestSchema, UpdatePageResponseSchema } from "./update/update.schema";
import { DeletePageHandler } from "./delete/delete.handler";
import { DeletePageParams, DeletePageParamsSchema, DeletePageResponseSchema } from "./delete/delete.schema";
import { PagesRepository } from "./pages.repository";
import { ErrorResponseSchema } from "../../shared/error-schema";

export async function pagesRoutes(app: FastifyInstance) {
  const pagesRepo = new PagesRepository();

  const createHandler = new CreatePageHandler(pagesRepo);
  const listHandler = new ListPagesHandler(pagesRepo);
  const getHandler = new GetPageHandler(pagesRepo);
  const updateHandler = new UpdatePageHandler(pagesRepo);
  const deleteHandler = new DeletePageHandler(pagesRepo);

  app.post<{ Body: CreatePageRequest }>("/", {
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
    preHandler: app.tryAuth,
    schema: {
      description: "List pages",
      tags: ["Pages"],
      querystring: ListPagesQuerySchema,
      response: { 200: ListPagesResponseSchema },
    },
  }, (request) => listHandler.handle(request));

  app.get<{ Params: GetPageParams }>("/:slug", {
    preHandler: app.tryAuth,
    schema: {
      description: "Get page by slug",
      tags: ["Pages"],
      params: GetPageParamsSchema,
      response: { 200: GetPageResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getHandler.handle(request));

  app.put<{ Params: UpdatePageParams; Body: UpdatePageRequest }>("/:id", {
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

  app.delete<{ Params: DeletePageParams }>("/:id", {
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
