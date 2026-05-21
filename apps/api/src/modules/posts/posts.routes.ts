import { FastifyInstance } from "fastify";
import { CreatePostHandler } from "./create/create.handler";
import { CreatePostRequest, CreatePostRequestSchema, PostResponseSchema } from "./create/create.schema";
import { ListPostsHandler } from "./list/list.handler";
import { ListPostsQuery, ListPostsQuerySchema, ListPostsResponseSchema } from "./list/list.schema";
import { GetPostHandler } from "./detail/detail.handler";
import { GetPostParams, GetPostParamsSchema, GetPostResponseSchema } from "./detail/detail.schema";
import { UpdatePostHandler } from "./update/update.handler";
import { UpdatePostParams, UpdatePostParamsSchema, UpdatePostRequest, UpdatePostRequestSchema, UpdatePostResponseSchema } from "./update/update.schema";
import { DeletePostHandler } from "./delete/delete.handler";
import { DeletePostParams, DeletePostParamsSchema, DeletePostResponseSchema } from "./delete/delete.schema";
import { PostsRepository } from "./posts.repository";
import { ErrorResponseSchema } from "../../shared/error-schema";

export async function postsRoutes(app: FastifyInstance) {
  const postsRepo = new PostsRepository();

  const createHandler = new CreatePostHandler(postsRepo);
  const listHandler = new ListPostsHandler(postsRepo);
  const getHandler = new GetPostHandler(postsRepo);
  const updateHandler = new UpdatePostHandler(postsRepo);
  const deleteHandler = new DeletePostHandler(postsRepo);

  app.post<{ Body: CreatePostRequest }>("/", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create a new blog post",
      tags: ["Posts"],
      security: [{ bearerAuth: [] }],
      body: CreatePostRequestSchema,
      response: { 200: PostResponseSchema, 401: ErrorResponseSchema },
    },
  }, (request) => createHandler.handle(request));

  app.get<{ Querystring: ListPostsQuery }>("/", {
    preHandler: app.tryAuth,
    schema: {
      description: "List blog posts",
      tags: ["Posts"],
      querystring: ListPostsQuerySchema,
      response: { 200: ListPostsResponseSchema },
    },
  }, (request) => listHandler.handle(request));

  app.get<{ Params: GetPostParams }>("/:slug", {
    preHandler: app.tryAuth,
    schema: {
      description: "Get blog post by slug",
      tags: ["Posts"],
      params: GetPostParamsSchema,
      response: { 200: GetPostResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getHandler.handle(request));

  app.put<{ Params: UpdatePostParams; Body: UpdatePostRequest }>("/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Update an existing blog post",
      tags: ["Posts"],
      security: [{ bearerAuth: [] }],
      params: UpdatePostParamsSchema,
      body: UpdatePostRequestSchema,
      response: { 200: UpdatePostResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => updateHandler.handle(request));

  app.delete<{ Params: DeletePostParams }>("/:id", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Delete a blog post",
      tags: ["Posts"],
      security: [{ bearerAuth: [] }],
      params: DeletePostParamsSchema,
      response: { 200: DeletePostResponseSchema, 401: ErrorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => deleteHandler.handle(request));
}
