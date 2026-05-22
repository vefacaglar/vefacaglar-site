import { Type, Static } from "@sinclair/typebox";
import { PageResponseSchema } from "../dashboard/create/create.schema";

export const ListPagesQuerySchema = Type.Object({
  status: Type.Optional(Type.Union([Type.Literal("draft"), Type.Literal("published")])),
});

export type ListPagesQuery = Static<typeof ListPagesQuerySchema>;

export const ListPagesResponseSchema = Type.Array(PageResponseSchema);

export type ListPagesResponse = Static<typeof ListPagesResponseSchema>;
