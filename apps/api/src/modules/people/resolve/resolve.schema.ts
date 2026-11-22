import { Type, type Static } from "@sinclair/typebox";
export const ResolvePersonParamsSchema = Type.Object({ wikidataId: Type.String({ pattern: "^Q[1-9][0-9]{0,20}$" }) });
export const ResolvedPersonSchema = Type.Object({ id: Type.String({ format: "uuid" }) });
export type ResolvePersonParams = Static<typeof ResolvePersonParamsSchema>;
export type ResolvedPerson = Static<typeof ResolvedPersonSchema>;
