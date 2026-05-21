import { Type, Static } from "@sinclair/typebox";

export const GetAuthorParamsSchema = Type.Object({
  username: Type.String(),
});

export type GetAuthorParams = Static<typeof GetAuthorParamsSchema>;

export const GetAuthorResponseSchema = Type.Object({
  username: Type.String(),
  displayName: Type.String(),
  posts: Type.Array(
    Type.Object({
      id: Type.String(),
      slug: Type.String(),
      title: Type.String(),
      excerpt: Type.Union([Type.String(), Type.Null()]),
      publishedAt: Type.Union([Type.String(), Type.Null()]),
    })
  ),
});

export type GetAuthorResponse = Static<typeof GetAuthorResponseSchema>;
