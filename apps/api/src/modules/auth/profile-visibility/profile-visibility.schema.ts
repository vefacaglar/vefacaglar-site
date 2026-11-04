import { Type, Static } from "@sinclair/typebox";

export const UpdateProfileVisibilityRequestSchema = Type.Object({
  isProfilePublic: Type.Boolean(),
});
export type UpdateProfileVisibilityRequest = Static<typeof UpdateProfileVisibilityRequestSchema>;

export const UpdateProfileVisibilityResponseSchema = Type.Object({
  isProfilePublic: Type.Boolean(),
});
export type UpdateProfileVisibilityResponse = Static<typeof UpdateProfileVisibilityResponseSchema>;
