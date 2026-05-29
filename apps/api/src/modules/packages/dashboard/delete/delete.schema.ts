import { Type, Static } from "@sinclair/typebox";

export const DeletePackageParamsSchema = Type.Object({
  id: Type.String(),
});
export type DeletePackageParams = Static<typeof DeletePackageParamsSchema>;

export const DeletePackageResponseSchema = Type.Object({
  success: Type.Boolean(),
});
export type DeletePackageResponse = Static<typeof DeletePackageResponseSchema>;
