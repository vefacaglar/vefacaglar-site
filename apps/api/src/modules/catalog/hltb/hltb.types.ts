import type { HltbPopularityGame, ImportedTimes } from "../import/import.types";

export const HLTB_LOOKUPS_REPOSITORY = Symbol("HLTB_LOOKUPS_REPOSITORY");
export const HLTB_LOOKUP_SERVICE = Symbol("HLTB_LOOKUP_SERVICE");
export type HoursField = keyof ImportedTimes;
export type HltbGame = {
  id: string; title: string; releaseYear: number | null;
  hltbId: number | null; mappingSource: string | null; times: ImportedTimes;
};
export type LookupOutcome = "matches" | "no_match" | "provider_unavailable";
export type LookupReceipt = {
  gameId: string; receiptId: string; query: string; expectedVersion: string;
  candidates: HltbPopularityGame[]; outcome: LookupOutcome; checkedAt: Date;
  expiresAt: Date; retryAfter: Date | null; failureCount: number;
  pendingSearchSync: boolean; syncVersion: string | null;
};
export type Candidate = {
  hltbId: number; title: string; releaseYear: number | null;
  times: ImportedTimes; sourceUrl: string; warnings: string[];
};
export type LookupResult = {
  game: HltbGame; expectedVersion: string; receiptId: string;
  query: string; outcome: LookupOutcome; candidates: Candidate[];
  expiresAt: string; retryAfter: string | null; cached: boolean; pendingSearchSync: boolean;
};
export type ApplyInput = {
  receiptId: string; hltbId: number; expectedVersion: string;
  overwriteFields?: HoursField[]; replaceMapping?: boolean; acknowledgeMismatch?: boolean;
};
export type ApplyResult = { game: HltbGame; searchSync: "synced" | "pending" };
export interface IHltbLookupsRepository {
  getGame(idOrSlug: string): Promise<HltbGame | null>;
  getReceipt(gameId: string): Promise<LookupReceipt | null>;
  saveReceipt(receipt: LookupReceipt): Promise<void>;
  apply(gameId: string, receipt: LookupReceipt, candidate: HltbPopularityGame, input: ApplyInput): Promise<{ game: HltbGame; syncVersion: string }>;
  withSearchSync<T>(gameId: string, work: () => Promise<T>): Promise<T>;
  clearPendingSync(gameId: string, syncVersion: string): Promise<void>;
  deferProvider(until: Date): Promise<void>;
  acquireProviderPermit(owner: string): Promise<{ acquired: boolean; retryAt: Date }>;
  releaseProviderPermit(owner: string, cooldownUntil: Date | null): Promise<void>;
}
export class HltbProviderUnavailable extends Error {
  constructor(public readonly retryAt: Date = new Date(Date.now() + 60_000)) {
    super("HowLongToBeat is temporarily unavailable. Try again later.");
  }
}
