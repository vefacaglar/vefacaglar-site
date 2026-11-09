import { Type, type Static } from "@sinclair/typebox";
export const MoviePosterBlockParamsSchema = Type.Object({ id: Type.String({ format: "uuid" }) });
export type MoviePosterBlockParams = Static<typeof MoviePosterBlockParamsSchema>;
export const MoviePosterBlockBodySchema = Type.Object({ blocked: Type.Boolean({ description: "true hides the poster image and its credit on every public page" }) });
export type MoviePosterBlockBody = Static<typeof MoviePosterBlockBodySchema>;
export const MoviePosterBlockSchema = Type.Object({ id: Type.String({ format: "uuid" }), posterBlocked: Type.Boolean(),
  posterBlockedAt: Type.Union([Type.String(), Type.Null()]) });
export type MoviePosterBlock = Static<typeof MoviePosterBlockSchema>;
