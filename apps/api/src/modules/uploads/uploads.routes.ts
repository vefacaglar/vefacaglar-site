import { FastifyInstance } from "fastify";
import { UploadImageHandler } from "./image/image.handler";
import { UploadImageResponseSchema } from "./image/image.schema";
import { ErrorResponseSchema } from "../../shared/error-schema";
import { container } from "../../container";

export async function uploadsRoutes(app: FastifyInstance) {
  const uploadImageHandler = container.resolve(UploadImageHandler);

  app.post("/image", {
    preHandler: app.requireAuth,
    schema: {
      description: "Upload an image securely to ImageKit",
      tags: ["Uploads"],
      security: [{ bearerAuth: [] }],
      response: {
        200: UploadImageResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, (request) => uploadImageHandler.handle(request));
}
