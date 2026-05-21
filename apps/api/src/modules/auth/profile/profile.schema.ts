import { Type, Static } from "@sinclair/typebox";

export const GetProfileResponseSchema = Type.Object({
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    username: Type.String(),
    displayName: Type.String(),
    role: Type.String(),
  }),
});
export type GetProfileResponse = Static<typeof GetProfileResponseSchema>;

export const UpdateProfileRequestSchema = Type.Object({
  email: Type.String({ format: "email" }),
  username: Type.String({ minLength: 3 }),
  displayName: Type.String({ minLength: 1 }),
});
export type UpdateProfileRequest = Static<typeof UpdateProfileRequestSchema>;

export const UpdateProfileResponseSchema = Type.Object({
  user: Type.Object({
    id: Type.String(),
    email: Type.String(),
    username: Type.String(),
    displayName: Type.String(),
    role: Type.String(),
  }),
});
export type UpdateProfileResponse = Static<typeof UpdateProfileResponseSchema>;

export const ChangePasswordRequestSchema = Type.Object({
  currentPassword: Type.String({ minLength: 1 }),
  newPassword: Type.String({ minLength: 6 }),
});
export type ChangePasswordRequest = Static<typeof ChangePasswordRequestSchema>;

export const ChangePasswordResponseSchema = Type.Object({
  message: Type.String(),
});
export type ChangePasswordResponse = Static<typeof ChangePasswordResponseSchema>;
