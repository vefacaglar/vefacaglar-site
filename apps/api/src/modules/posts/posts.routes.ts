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

export async function postsRoutes(app: FastifyInstance) {
  const createHandler = new CreatePostHandler();
  const listHandler = new ListPostsHandler();
  const getHandler = new GetPostHandler();
  const updateHandler = new UpdatePostHandler();
  const deleteHandler = new DeletePostHandler();

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
          return reply.status(401).send({ message: "Yetkisiz işlem. Admin girişi yapmalısınız." });
        }
        console.error(error);
        return reply.status(500).send({ message: "Post oluşturulurken hata oluştu." });
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
          return reply.status(404).send({ message: "Yazı bulunamadı." });
        }
        console.error(error);
        return reply.status(500).send({ message: "Yazı getirilirken hata oluştu." });
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
          return reply.status(401).send({ message: "Yetkisiz işlem. Admin girişi yapmalısınız." });
        }
        if (error.message === "PostNotFound") {
          return reply.status(404).send({ message: "Yazı bulunamadı." });
        }
        console.error(error);
        return reply.status(500).send({ message: "Yazı güncellenirken hata oluştu." });
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
          return reply.status(401).send({ message: "Yetkisiz işlem. Admin girişi yapmalısınız." });
        }
        if (error.message === "PostNotFound") {
          return reply.status(404).send({ message: "Yazı bulunamadı." });
        }
        console.error(error);
        return reply.status(500).send({ message: "Yazı silinirken hata oluştu." });
      }
    }
  );
}
