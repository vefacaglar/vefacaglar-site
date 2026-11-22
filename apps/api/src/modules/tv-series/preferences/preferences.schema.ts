import { Type, type Static } from "@sinclair/typebox";
export { GetTvSeriesParamsSchema as TvPreferenceParamsSchema } from "../detail/detail.schema";
export type { GetTvSeriesParams as TvPreferenceParams } from "../detail/detail.schema";
export const TvPreferencesSchema = Type.Object({
  rating: Type.Union([Type.Integer({ minimum: 1, maximum: 10 }), Type.Null()]),
  note: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()]),
  ratingVersion: Type.Integer({ minimum: 0 }),
  noteVersion: Type.Integer({ minimum: 0 }),
});
export const TvRatingBodySchema = Type.Object({
  rating: Type.Union([Type.Integer({ minimum: 1, maximum: 10 }), Type.Null()]),
  expectedVersion: Type.Integer({ minimum: 0, maximum: 2147483646 }),
}, { additionalProperties: false });
export const TvNoteBodySchema = Type.Object({
  note: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()]),
  expectedVersion: Type.Integer({ minimum: 0, maximum: 2147483646 }),
}, { additionalProperties: false });
export type TvPreferences = Static<typeof TvPreferencesSchema>;
export type TvRatingBody = Static<typeof TvRatingBodySchema>;
export type TvNoteBody = Static<typeof TvNoteBodySchema>;
