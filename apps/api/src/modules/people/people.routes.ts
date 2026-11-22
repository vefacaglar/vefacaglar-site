import type { FastifyInstance } from "fastify";
import { container } from "../../container";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { GetPersonHandler } from "./detail/detail.handler";
import { PersonParamsSchema, PersonQuerySchema, PersonPageSchema, type PersonParams, type PersonQuery } from "./detail/detail.schema";
import { ResolvePersonHandler } from "./resolve/resolve.handler";
import { ResolvePersonParamsSchema, ResolvedPersonSchema, type ResolvePersonParams } from "./resolve/resolve.schema";
export async function peopleRoutes(app: FastifyInstance) {
  const detail = container.resolve(GetPersonHandler);
  const resolve = container.resolve(ResolvePersonHandler);
  app.get<{ Params: ResolvePersonParams }>("/resolve/:wikidataId", { schema: {
    tags: ["People"], description: "Resolve a legacy Wikidata person identity to its canonical public profile",
    params: ResolvePersonParamsSchema, response: { 200: ResolvedPersonSchema, 404: ErrorResponseSchema },
  } }, (request) => resolve.handle(request));
  app.get<{ Params: PersonParams; Querystring: PersonQuery }>("/:id", { schema: {
    tags: ["People"], description: "A person's public film and TV series credits in this catalog",
    params: PersonParamsSchema, querystring: PersonQuerySchema, response: { 200: PersonPageSchema, 404: ErrorResponseSchema },
  } }, (request) => detail.handle(request));
}
