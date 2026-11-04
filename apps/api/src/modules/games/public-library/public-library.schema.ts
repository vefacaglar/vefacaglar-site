import { Type, Static } from "@sinclair/typebox";
import { LibraryResponseSchema } from "../library/library.schema";

export const PublicLibraryParamsSchema = Type.Object({
  username: Type.String({ minLength: 1 }),
});
export type PublicLibraryParams = Static<typeof PublicLibraryParamsSchema>;

export const PublicLibraryResponseSchema = Type.Object({
  /** Public identity only — never the user's id or email. */
  user: Type.Object({
    username: Type.String(),
    displayName: Type.String(),
    isProfilePublic: Type.Boolean(),
  }),
  /** True when the signed-in viewer owns this library (they can see it even while private). */
  isOwner: Type.Boolean(),
  summary: LibraryResponseSchema.properties.summary,
  games: LibraryResponseSchema.properties.games,
});
export type PublicLibraryResponse = Static<typeof PublicLibraryResponseSchema>;
