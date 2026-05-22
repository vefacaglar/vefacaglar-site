import { FastifyInstance } from "fastify";
import { GetAuthorHandler } from "./detail/detail.handler";
import { GetAuthorParams, GetAuthorParamsSchema, GetAuthorResponseSchema } from "./detail/detail.schema";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { container } from "../../container";

export async function authorsRoutes(app: FastifyInstance) {
  const getHandler = container.resolve(GetAuthorHandler);

  app.get<{ Params: GetAuthorParams }>("/:username", {
    schema: {
      description: "Get author profile and their published posts",
      tags: ["Authors"],
      params: GetAuthorParamsSchema,
      response: { 200: GetAuthorResponseSchema, 404: ErrorResponseSchema },
    },
  }, (request) => getHandler.handle(request));
}
