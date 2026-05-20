import { Type, Static } from "@sinclair/typebox";

export const LogoutResponseSchema = Type.Object({
  message: Type.String(),
});
export type LogoutResponse = Static<typeof LogoutResponseSchema>;
