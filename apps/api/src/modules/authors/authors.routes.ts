import { FastifyInstance } from "fastify";
import { GetAuthorHandler } from "./detail/detail.handler";
import { GetAuthorParams, GetAuthorParamsSchema, GetAuthorResponseSchema } from "./detail/detail.schema";
import { UsersRepository } from "../auth/users.repository";
import { PostsRepository } from "../posts/posts.repository";
import { ErrorResponseSchema } from "../../shared/error-schema";

export async function authorsRoutes(app: FastifyInstance) {
  const getHandler = new GetAuthorHandler(new UsersRepository(), new PostsRepository());

  app.get<{ Params: GetAuthorParams }>("/:username", {
    schema: {
      description: "Get author profile and their published posts",
      tags: ["Authors"],
      params: GetAuthorParamsSchema,
      response: { 200: GetAuthorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getHandler.handle(request));
}
