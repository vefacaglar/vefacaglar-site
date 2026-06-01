import { Type, Static } from "@sinclair/typebox";
import { GenreResponseSchema } from "../genres/list/list.schema";
import { ThemeResponseSchema } from "../themes/list/list.schema";
import { PlatformResponseSchema } from "../platforms/list/list.schema";

export const RelationsOptionsResponseSchema = Type.Object({
  genres: Type.Array(GenreResponseSchema),
  themes: Type.Array(ThemeResponseSchema),
  platforms: Type.Array(PlatformResponseSchema),
});

export type RelationsOptionsResponse = Static<typeof RelationsOptionsResponseSchema>;
