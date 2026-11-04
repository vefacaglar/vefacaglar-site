import { Type, Static } from "@sinclair/typebox";

export const MeResponseSchema = Type.Object({
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    username: Type.String(),
    displayName: Type.String(),
    role: Type.String(),
    isProfilePublic: Type.Boolean(),
  }),
});
export type MeResponse = Static<typeof MeResponseSchema>;
