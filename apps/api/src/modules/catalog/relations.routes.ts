import { FastifyInstance } from "fastify";
import { container } from "../../container";
import { LinkGameDeveloperHandler } from "./games/relations/developers/link.handler";
import { UnlinkGameDeveloperHandler } from "./games/relations/developers/unlink.handler";
import { LinkGamePublisherHandler } from "./games/relations/publishers/link.handler";
import { UnlinkGamePublisherHandler } from "./games/relations/publishers/unlink.handler";
import { LinkGameGenreHandler } from "./games/relations/genres/link.handler";
import { UnlinkGameGenreHandler } from "./games/relations/genres/unlink.handler";
import { LinkGamePlatformHandler } from "./games/relations/platforms/link.handler";
import { UnlinkGamePlatformHandler } from "./games/relations/platforms/unlink.handler";
import { LinkGameThemeHandler } from "./games/relations/themes/link.handler";
import { UnlinkGameThemeHandler } from "./games/relations/themes/unlink.handler";
import {
  LinkDeveloperParams,
  LinkDeveloperParamsSchema,
  LinkPublisherParams,
  LinkPublisherParamsSchema,
  LinkGenreParams,
  LinkGenreParamsSchema,
  LinkPlatformParams,
  LinkPlatformParamsSchema,
  LinkThemeParams,
  LinkThemeParamsSchema,
  RelationMutationResponseSchema,
} from "./games/relations/relation.schemas";
import { ErrorResponseSchema } from "../../shared/error-schema";

export async function gameRelationsRoutes(app: FastifyInstance) {
  const linkGameDeveloperHandler = container.resolve(LinkGameDeveloperHandler);
  const unlinkGameDeveloperHandler = container.resolve(UnlinkGameDeveloperHandler);
  const linkGamePublisherHandler = container.resolve(LinkGamePublisherHandler);
  const unlinkGamePublisherHandler = container.resolve(UnlinkGamePublisherHandler);
  const linkGameGenreHandler = container.resolve(LinkGameGenreHandler);
  const unlinkGameGenreHandler = container.resolve(UnlinkGameGenreHandler);
  const linkGamePlatformHandler = container.resolve(LinkGamePlatformHandler);
  const unlinkGamePlatformHandler = container.resolve(UnlinkGamePlatformHandler);
  const linkGameThemeHandler = container.resolve(LinkGameThemeHandler);
  const unlinkGameThemeHandler = container.resolve(UnlinkGameThemeHandler);

  app.post<{ Params: LinkDeveloperParams }>("/games/:id/developers/:developerId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Link a developer to a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkDeveloperParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => linkGameDeveloperHandler.handle(request));

  app.delete<{ Params: LinkDeveloperParams }>("/games/:id/developers/:developerId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Unlink a developer from a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkDeveloperParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => unlinkGameDeveloperHandler.handle(request));

  app.post<{ Params: LinkPublisherParams }>("/games/:id/publishers/:publisherId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Link a publisher to a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkPublisherParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => linkGamePublisherHandler.handle(request));

  app.delete<{ Params: LinkPublisherParams }>("/games/:id/publishers/:publisherId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Unlink a publisher from a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkPublisherParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => unlinkGamePublisherHandler.handle(request));

  app.post<{ Params: LinkGenreParams }>("/games/:id/genres/:genreId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Link a genre to a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkGenreParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => linkGameGenreHandler.handle(request));

  app.delete<{ Params: LinkGenreParams }>("/games/:id/genres/:genreId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Unlink a genre from a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkGenreParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => unlinkGameGenreHandler.handle(request));

  app.post<{ Params: LinkPlatformParams }>("/games/:id/platforms/:platformId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Link a platform to a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkPlatformParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => linkGamePlatformHandler.handle(request));

  app.delete<{ Params: LinkPlatformParams }>("/games/:id/platforms/:platformId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Unlink a platform from a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkPlatformParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => unlinkGamePlatformHandler.handle(request));

  app.post<{ Params: LinkThemeParams }>("/games/:id/themes/:themeId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Link a theme to a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkThemeParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => linkGameThemeHandler.handle(request));

  app.delete<{ Params: LinkThemeParams }>("/games/:id/themes/:themeId", {
    preHandler: app.requireAdmin,
    schema: {
      description: "Unlink a theme from a game",
      tags: ["Games - Relations"],
      security: [{ bearerAuth: [] }],
      params: LinkThemeParamsSchema,
      response: {
        200: RelationMutationResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, (request) => unlinkGameThemeHandler.handle(request));
}
