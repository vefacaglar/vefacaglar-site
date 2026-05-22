import { FastifyInstance } from "fastify";
import { container } from "../../container";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { GetLocalizationHandler } from "./detail/detail.handler";
import {
  GetLocalizationQuery,
  GetLocalizationQuerySchema,
  GetLocalizationResponseSchema,
} from "./detail/detail.schema";
import { UpsertLocalizationHandler } from "./upsert/upsert.handler";
import {
  UpsertLocalizationRequest,
  UpsertLocalizationRequestSchema,
  UpsertLocalizationResponseSchema,
} from "./upsert/upsert.schema";

export async function localizationsRoutes(app: FastifyInstance) {
  const getHandler = container.resolve(GetLocalizationHandler);
  const upsertHandler = container.resolve(UpsertLocalizationHandler);

  app.get<{ Querystring: GetLocalizationQuery }>("/", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Get a localized field value",
      tags: ["Localizations"],
      security: [{ bearerAuth: [] }],
      querystring: GetLocalizationQuerySchema,
      response: {
        200: GetLocalizationResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, (request) => getHandler.handle(request.query));

  app.post<{ Body: UpsertLocalizationRequest }>("/", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Create or update a localized field value",
      tags: ["Localizations"],
      security: [{ bearerAuth: [] }],
      body: UpsertLocalizationRequestSchema,
      response: {
        200: UpsertLocalizationResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, (request) => upsertHandler.handle(request.body));
}
