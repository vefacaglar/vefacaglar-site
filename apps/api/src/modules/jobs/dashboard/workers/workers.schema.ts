import { Type, Static } from "@sinclair/typebox";
import { WorkerSchema } from "../../jobs.schema";

export const ListWorkersResponseSchema = Type.Object({
  items: Type.Array(WorkerSchema),
});
export type ListWorkersResponse = Static<typeof ListWorkersResponseSchema>;
