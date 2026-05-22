import { FastifyInstance } from "fastify";
import { CreateProjectHandler } from "./create/create.handler";
import { CreateProjectRequest, CreateProjectRequestSchema, ProjectResponseSchema } from "./create/create.schema";
import { ListProjectsHandler } from "./list/list.handler";
import { ListProjectsQuery, ListProjectsQuerySchema, ListProjectsResponseSchema } from "./list/list.schema";
import { ListAdminProjectsHandler } from "./admin/list/list.handler";
import { ListAdminProjectsQuery, ListAdminProjectsQuerySchema, ListAdminProjectsResponseSchema } from "./admin/list/list.schema";
import { GetProjectHandler } from "./detail/detail.handler";
import { GetProjectParams, GetProjectParamsSchema, GetProjectResponseSchema } from "./detail/detail.schema";
import { GetAdminProjectHandler } from "./admin/detail/detail.handler";
import { GetAdminProjectParams, GetAdminProjectParamsSchema, GetAdminProjectResponseSchema } from "./admin/detail/detail.schema";
import { UpdateProjectHandler } from "./update/update.handler";
import { UpdateProjectParams, UpdateProjectParamsSchema, UpdateProjectRequest, UpdateProjectRequestSchema, UpdateProjectResponseSchema } from "./update/update.schema";
import { DeleteProjectHandler } from "./delete/delete.handler";
import { DeleteProjectParams, DeleteProjectParamsSchema, DeleteProjectResponseSchema } from "./delete/delete.schema";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { container } from "../../container";

export async function projectsRoutes(app: FastifyInstance) {
  const createHandler = container.resolve(CreateProjectHandler);
  const listHandler = container.resolve(ListProjectsHandler);
  const listAdminHandler = container.resolve(ListAdminProjectsHandler);
  const getHandler = container.resolve(GetProjectHandler);
  const getAdminHandler = container.resolve(GetAdminProjectHandler);
  const updateHandler = container.resolve(UpdateProjectHandler);
  const deleteHandler = container.resolve(DeleteProjectHandler);

  app.post<{ Body: CreateProjectRequest }>("/", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new project",
      tags: ["Projects"],
      security: [{ bearerAuth: [] }],
      body: CreateProjectRequestSchema,
      response: { 200: ProjectResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => createHandler.handle(request));

  app.get<{ Querystring: ListProjectsQuery }>("/", {
    preHandler: app.tryAuth,
    schema: {
      description: "List projects",
      tags: ["Projects"],
      querystring: ListProjectsQuerySchema,
      response: { 200: ListProjectsResponseSchema },
    },
  }, (request) => listHandler.handle(request));

  app.get<{ Querystring: ListAdminProjectsQuery }>("/admin", {
    preHandler: app.requireAdmin,
    schema: {
      description: "List raw projects for admin",
      tags: ["Projects"],
      security: [{ bearerAuth: [] }],
      querystring: ListAdminProjectsQuerySchema,
      response: { 200: ListAdminProjectsResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => listAdminHandler.handle(request));

  app.get<{ Params: GetAdminProjectParams }>("/admin/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get raw project by id for admin editing",
      tags: ["Projects"],
      security: [{ bearerAuth: [] }],
      params: GetAdminProjectParamsSchema,
      response: { 200: GetAdminProjectResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getAdminHandler.handle(request));

  app.get<{ Params: GetProjectParams }>("/:slug", {
    preHandler: app.tryAuth,
    schema: {
      description: "Get project by slug",
      tags: ["Projects"],
      params: GetProjectParamsSchema,
      response: { 200: GetProjectResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getHandler.handle(request));

  app.put<{ Params: UpdateProjectParams; Body: UpdateProjectRequest }>("/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update an existing project",
      tags: ["Projects"],
      security: [{ bearerAuth: [] }],
      params: UpdateProjectParamsSchema,
      body: UpdateProjectRequestSchema,
      response: { 200: UpdateProjectResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => updateHandler.handle(request));

  app.delete<{ Params: DeleteProjectParams }>("/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a project",
      tags: ["Projects"],
      security: [{ bearerAuth: [] }],
      params: DeleteProjectParamsSchema,
      response: { 200: DeleteProjectResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => deleteHandler.handle(request));
}
