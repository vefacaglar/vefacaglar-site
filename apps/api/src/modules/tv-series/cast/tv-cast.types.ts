export const TV_CAST_REPOSITORY = Symbol("TvCastRepository");
export type PersonProof = { qid: string; method: "tvmaze_person_id" | "show_cast_birthdate" };
export type TvCastPerson = { externalId: number; name: string | null; sourceUrl: string; birthDate: string | null; deathDate: string | null; gender: string | null; country: string | null; sourceUpdatedAt: Date | null };
export type TvCastRole = { person: TvCastPerson; characterId: number; characterName: string | null; characterSourceUrl: string; castOrder: number; self: boolean | null; voice: boolean | null };
/** Database candidates retain raw timestamp text; JS Date truncates microseconds. */
export type TvCastItem = { seriesId: number; sourceUrl: string; requestedAt: Date | string };
export type TvPersonIdentity = { externalId: number; qid: string };
export interface ITvCastRepository {
  state(): Promise<{ identityMap: unknown; identitiesCheckedAt: Date | null }>;
  identities(rows: TvPersonIdentity[], at: Date): Promise<void>;
  prepare(now: Date): Promise<void>;
  candidates(limit: number, now: Date): Promise<TvCastItem[]>;
  publish(item: TvCastItem, rows: TvCastRole[], proofs: Map<number, PersonProof>, identityCheckedAt: Date, at: Date): Promise<{ people: number; matched: number; merged: number }>;
  identityCandidates(ids: number[], before: Date): Promise<number[]>;
  existingFilmQids(qids: string[]): Promise<string[]>;
  failure(item: TvCastItem, code: string, retryAt: Date): Promise<void>;
  hasMore(now: Date): Promise<boolean>;
}
