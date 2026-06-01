import { Type, Static } from "@sinclair/typebox";

export const LinkDeveloperParamsSchema = Type.Object({
  id: Type.String(),
  developerId: Type.String(),
});
export type LinkDeveloperParams = Static<typeof LinkDeveloperParamsSchema>;

export const LinkPublisherParamsSchema = Type.Object({
  id: Type.String(),
  publisherId: Type.String(),
});
export type LinkPublisherParams = Static<typeof LinkPublisherParamsSchema>;

export const LinkGenreParamsSchema = Type.Object({
  id: Type.String(),
  genreId: Type.String(),
});
export type LinkGenreParams = Static<typeof LinkGenreParamsSchema>;

export const LinkPlatformParamsSchema = Type.Object({
  id: Type.String(),
  platformId: Type.String(),
});
export type LinkPlatformParams = Static<typeof LinkPlatformParamsSchema>;

export const LinkThemeParamsSchema = Type.Object({
  id: Type.String(),
  themeId: Type.String(),
});
export type LinkThemeParams = Static<typeof LinkThemeParamsSchema>;

export const RelationMutationResponseSchema = Type.Object({
  success: Type.Boolean(),
});
export type RelationMutationResponse = Static<typeof RelationMutationResponseSchema>;
