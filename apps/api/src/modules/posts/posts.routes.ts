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

export async function postsRoutes(app: FastifyInstance) {
  const postsRepo = new PostsRepository();

  const createHandler = new CreatePostHandler(postsRepo);
  const listHandler = new ListPostsHandler(postsRepo);
  const getHandler = new GetPostHandler(postsRepo);
  const updateHandler = new UpdatePostHandler(postsRepo);
  const deleteHandler = new DeletePostHandler(postsRepo);

  // POST /
  app.post<{ Body: CreatePostRequest }>(
    "/",
    {
      preHandler: app.requireAdmin,
      schema: {
        description: "Create a new blog post",
        tags: ["Posts"],
        security: [{ bearerAuth: [] }],
        body: CreatePostRequestSchema,
        response: {
          200: PostResponseSchema,
          401: { type: "object", properties: { message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        return await createHandler.handle(request);
      } catch (error) {
        console.error(error);
        return reply.status(500).send({ message: "An error occurred while creating the post." });
      }
    }
  );

  // GET /
  app.get<{ Querystring: ListPostsQuery }>(
    "/",
    {
      preHandler: app.tryAuth,
      schema: {
        description: "List blog posts",
        tags: ["Posts"],
        querystring: ListPostsQuerySchema,
        response: {
          200: ListPostsResponseSchema,
        },
      },
    },
    async (request) => {
      return await listHandler.handle(request);
    }
  );

  // GET /:slug
  app.get<{ Params: GetPostParams }>(
    "/:slug",
    {
      preHandler: app.tryAuth,
      schema: {
        description: "Get blog post by slug",
        tags: ["Posts"],
        params: GetPostParamsSchema,
        response: {
          200: GetPostResponseSchema,
          404: { type: "object", properties: { message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        return await getHandler.handle(request);
      } catch (error: any) {
        if (error.message === "PostNotFound") {
          return reply.status(404).send({ message: "Post not found." });
        }
        console.error(error);
        return reply.status(500).send({ message: "An error occurred while fetching the post." });
      }
    }
  );

  // PUT /:id
  app.put<{ Params: UpdatePostParams; Body: UpdatePostRequest }>(
    "/:id",
    {
      preHandler: app.requireAdmin,
      schema: {
        description: "Update an existing blog post",
        tags: ["Posts"],
        security: [{ bearerAuth: [] }],
        params: UpdatePostParamsSchema,
        body: UpdatePostRequestSchema,
        response: {
          200: UpdatePostResponseSchema,
          401: { type: "object", properties: { message: { type: "string" } } },
          404: { type: "object", properties: { message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        return await updateHandler.handle(request);
      } catch (error: any) {
        if (error.message === "PostNotFound") {
          return reply.status(404).send({ message: "Post not found." });
        }
        console.error(error);
        return reply.status(500).send({ message: "An error occurred while updating the post." });
      }
    }
  );

  // DELETE /:id
  app.delete<{ Params: DeletePostParams }>(
    "/:id",
    {
      preHandler: app.requireAdmin,
      schema: {
        description: "Delete a blog post",
        tags: ["Posts"],
        security: [{ bearerAuth: [] }],
        params: DeletePostParamsSchema,
        response: {
          200: DeletePostResponseSchema,
          401: { type: "object", properties: { message: { type: "string" } } },
          404: { type: "object", properties: { message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        return await deleteHandler.handle(request);
      } catch (error: any) {
        if (error.message === "PostNotFound") {
          return reply.status(404).send({ message: "Post not found." });
        }
        console.error(error);
        return reply.status(500).send({ message: "An error occurred while deleting the post." });
      }
    }
  );
}
