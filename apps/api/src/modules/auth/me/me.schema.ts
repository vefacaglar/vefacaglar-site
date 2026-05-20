import { Type, Static } from "@sinclair/typebox";

export const MeResponseSchema = Type.Object({
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    displayName: Type.String(),
    role: Type.String(),
  }),
});
export type MeResponse = Static<typeof MeResponseSchema>;
