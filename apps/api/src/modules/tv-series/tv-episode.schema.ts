import { Type, type Static } from "@sinclair/typebox";
import { NullableString, NullableNumber } from "./list/list.schema";
export const TvEpisodeSchema = Type.Object({
  id: Type.Integer(), isSpecial: Type.Boolean(), number: NullableNumber, name: NullableString, summary: NullableString, type: NullableString,
  airdate: NullableString, airstamp: NullableString, runtimeMinutes: NullableNumber, rating: NullableNumber, sourceUrl: Type.String(),
});
export type TvEpisode = Static<typeof TvEpisodeSchema>;
