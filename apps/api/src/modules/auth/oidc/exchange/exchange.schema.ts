import { Type, Static } from "@sinclair/typebox";

export const OidcExchangeRequestSchema = Type.Object({
  idToken: Type.String({ minLength: 1 }),
  nonce: Type.String({ minLength: 1 }),
});
export type OidcExchangeRequest = Static<typeof OidcExchangeRequestSchema>;
