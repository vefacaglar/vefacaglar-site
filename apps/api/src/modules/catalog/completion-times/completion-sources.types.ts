export const GAME_COMPLETION_SOURCES = Symbol("GameCompletionSources");
export const COMPLETION_SOURCES_REPOSITORY = Symbol("CompletionSourcesRepository");
export type CompletionProvider = "backloggd" | "ifdb" | "vndb";
export type CompletionIdentity = { igdbId: number; slug: string; wikidataId?: string; ifdbId?: string; vndbId?: string };
export type CompletionReport = {
  provider: CompletionProvider;
  sourceUrl: string;
  scope: string;
  statistic: "reported" | "median_finish" | "average_playtime";
  finishSeconds: number | null;
  masterSeconds: number | null;
  playtimeSeconds: number | null;
  sampleCount: number | null;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
};
export type CompletionObservation = {
  identity: CompletionIdentity;
  provider: CompletionProvider;
  externalId: string;
  report: CompletionReport | null;
  nextCheckAt: Date;
  invalidate?: boolean;
};
export type CompletionProviderState = {
  cooldownUntil: Date | null;
  errorCode: string | null;
  identityMap: unknown;
  mapCheckedAt: Date | null;
};
export interface ICompletionSourcesRepository {
  state(provider: string): Promise<CompletionProviderState | null>;
  failure(provider: string, code: string, retryAt: Date): Promise<void>;
  saveMap(identities: CompletionIdentity[], checkedAt: Date): Promise<void>;
  catalogSlugs(slugs: string[]): Promise<{ igdbId: number; slug: string }[]>;
  backloggdCandidates(now: Date): Promise<CompletionIdentity[]>;
  due(provider: CompletionProvider, identities: CompletionIdentity[], now: Date): Promise<CompletionIdentity[]>;
  save(observations: CompletionObservation[], checkedAt: Date): Promise<{ accepted: number; added: number }>;
}
export interface ICompletionSourcesRefresher {
  refresh(progress?: (message: string) => void): Promise<{ sources: { provider: CompletionProvider; attempted: number; accepted: number; added: number; status: string }[]; identityCount: number }>;
}
