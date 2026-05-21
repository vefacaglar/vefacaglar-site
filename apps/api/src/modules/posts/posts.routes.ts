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
import { UsersRepository } from "../auth/users.repository";
import { SessionsRepository } from "../auth/sessions.repository";
import { AuthService } from "../auth/auth.service";

export async function postsRoutes(app: FastifyInstance) {
  const postsRepo = new PostsRepository();
  const auth = new AuthService(new UsersRepository(), new SessionsRepository());

  const createHandler = new CreatePostHandler(postsRepo, auth);
  const listHandler = new ListPostsHandler(postsRepo, auth);
  const getHandler = new GetPostHandler(postsRepo, auth);
  const updateHandler = new UpdatePostHandler(postsRepo, auth);
  const deleteHandler = new DeletePostHandler(postsRepo, auth);

  // POST /
  app.post<{ Body: CreatePostRequest }>(
    "/",
    {
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
        const result = await createHandler.handle(request);
        return result;
      } catch (error: any) {
        if (error.message === "Unauthorized") {
          return reply.status(401).send({ message: "Unauthorized action. You must log in as admin." });
        }
        console.error(error);
        return reply.status(500).send({ message: "An error occurred while creating the post." });
      }
    }
  );

  // GET /
  app.get<{ Querystring: ListPostsQuery }>(
    "/",
    {
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
        const result = await getHandler.handle(request);
        return result;
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
        const result = await updateHandler.handle(request);
        return result;
      } catch (error: any) {
        if (error.message === "Unauthorized") {
          return reply.status(401).send({ message: "Unauthorized action. You must log in as admin." });
        }
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
        const result = await deleteHandler.handle(request);
        return result;
      } catch (error: any) {
        if (error.message === "Unauthorized") {
          return reply.status(401).send({ message: "Unauthorized action. You must log in as admin." });
        }
        if (error.message === "PostNotFound") {
          return reply.status(404).send({ message: "Post not found." });
        }
        console.error(error);
        return reply.status(500).send({ message: "An error occurred while deleting the post." });
      }
    }
  );
}
