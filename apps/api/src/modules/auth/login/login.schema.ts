import { Type, Static } from "@sinclair/typebox";

export const LoginRequestSchema = Type.Object({
  email: Type.String({ format: "email" }),
  password: Type.String(),
});
export type LoginRequest = Static<typeof LoginRequestSchema>;

export const LoginResponseSchema = Type.Object({
  token: Type.String(),
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    displayName: Type.String(),
    role: Type.String(),
  }),
});
export type LoginResponse = Static<typeof LoginResponseSchema>;
