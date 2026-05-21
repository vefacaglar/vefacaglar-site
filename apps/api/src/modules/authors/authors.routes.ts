import { FastifyInstance } from "fastify";
import { GetAuthorHandler } from "./detail/detail.handler";
import { GetAuthorParams, GetAuthorParamsSchema, GetAuthorResponseSchema } from "./detail/detail.schema";
import { UsersRepository } from "../auth/users.repository";
import { PostsRepository } from "../posts/posts.repository";

export async function authorsRoutes(app: FastifyInstance) {
  const getHandler = new GetAuthorHandler(new UsersRepository(), new PostsRepository());

  // GET /:username
  app.get<{ Params: GetAuthorParams }>(
    "/:username",
    {
      schema: {
        description: "Get author profile and their published posts",
        tags: ["Authors"],
        params: GetAuthorParamsSchema,
        response: {
          200: GetAuthorResponseSchema,
          404: { type: "object", properties: { message: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await getHandler.handle(request);
        return result;
      } catch (error: any) {
        if (error.message === "AuthorNotFound") {
          return reply.status(404).send({ message: "Author not found." });
        }
        console.error(error);
        return reply.status(500).send({ message: "An error occurred while fetching the author." });
      }
    }
  );
}
