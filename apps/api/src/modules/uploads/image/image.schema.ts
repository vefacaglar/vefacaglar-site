import { Type, Static } from "@sinclair/typebox";

export const UploadImageResponseSchema = Type.Object({
  url: Type.String(),
});

export type UploadImageResponse = Static<typeof UploadImageResponseSchema>;
