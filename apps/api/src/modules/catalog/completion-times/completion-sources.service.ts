import { inject, injectable } from "tsyringe";
import { CompletionSourcesClient, CompletionSourceError } from "./completion-sources.client";
import { COMPLETION_SOURCES_REPOSITORY, type CompletionIdentity, type CompletionObservation, type CompletionProvider,
  type ICompletionSourcesRepository, type ICompletionSourcesRefresher } from "./completion-sources.types";

const DAY = 86400_000;
const MAX_IDENTITIES = 5000;

@injectable()
export class CompletionSourcesService implements ICompletionSourcesRefresher {
  constructor(
    private readonly client: CompletionSourcesClient,
    @inject(COMPLETION_SOURCES_REPOSITORY) private readonly repository: ICompletionSourcesRepository,
  ) {}

  async refresh(progress: (message: string) => void = () => {}) {
    const deadline = Date.now() + 8 * 60_000;
    let identities: CompletionIdentity[] = [];
    progress("Resolving independently verified completion identities");
    try { identities = await this.identities(deadline); }
    catch { /* Other sources remain independent of identity discovery outages. */ }
    progress(`Independent identity map games=${identities.length}`);
    const sources: { provider: CompletionProvider; attempted: number; accepted: number; added: number; status: string }[] = [];
    for (const provider of ["backloggd", "vndb", "ifdb"] as const) {
      const result = { provider, attempted: 0, accepted: 0, added: 0, status: "cached" };
      const state = await this.repository.state(provider);
      if (state?.cooldownUntil && state.cooldownUntil.getTime() > Date.now()) { result.status = "cooldown"; sources.push(result); continue; }
      progress(`${provider} refresh started`);
      const observations: CompletionObservation[] = [];
      const flush = async () => {
        if (!observations.length) return;
        const saved = await this.repository.save(observations.splice(0), new Date());
        result.accepted += saved.accepted;
        result.added += saved.added;
      };
      try {
        if (Date.now() >= deadline) throw new CompletionSourceError("completion_source_budget_exhausted");
        if (provider === "backloggd") {
          const candidates = await this.repository.backloggdCandidates(new Date());
          if (candidates.length) {
            const canonical = new Map((await this.client.canonical(candidates.map((row) => row.igdbId), deadline)).map((row) => [row.igdbId, row.slug]));
            const robots = await this.client.robots(deadline);
            for (const candidate of candidates) {
              const slug = canonical.get(candidate.igdbId);
              if (!slug) {
                observations.push({ identity: candidate, provider, externalId: candidate.slug, report: null, nextCheckAt: new Date(Date.now() + 30 * DAY) });
                continue;
              }
              const identity = { igdbId: candidate.igdbId, slug };
              result.attempted++;
              if (result.attempted === 1 || result.attempted % 8 === 0) progress(`backloggd checking game=${result.attempted} of ${candidates.length}`);
              try {
                const report = await this.client.backloggd(identity, robots, deadline);
                observations.push({ identity, provider, externalId: slug, report, nextCheckAt: new Date(Date.now() + (report ? 3 : 7) * DAY) });
              } catch (error) {
                if (error instanceof CompletionSourceError && ["completion_source_http_404", "completion_source_http_301", "completion_source_http_302", "completion_source_http_303", "completion_source_http_307", "completion_source_http_308"].includes(error.code)) {
                  observations.push({ identity, provider, externalId: slug, report: null, nextCheckAt: new Date(Date.now() + 30 * DAY) });
                } else if (error instanceof Error && ["backloggd_identity_mismatch", "backloggd_conflicting_public_values"].includes(error.message)) {
                  observations.push({ identity, provider, externalId: slug, report: null, nextCheckAt: new Date(Date.now() + 30 * DAY),
                    invalidate: error.message === "backloggd_identity_mismatch" });
                } else throw error;
              }
              if (observations.length >= 8) await flush();
            }
          }
        } else {
          if (!identities.length) result.status = "identity_unavailable";
          const eligible = identities.filter((identity) => provider === "ifdb" ? !!identity.ifdbId : !!identity.vndbId);
          const due = await this.repository.due(provider, eligible, new Date());
          if (provider === "vndb") {
            for (let offset = 0; offset < due.length; offset += 100) {
              const batch = due.slice(offset, offset + 100);
              result.attempted += batch.length;
              progress(`${provider} checking games=${result.attempted} of ${due.length}`);
              const reports = await this.client.vndb(batch, deadline);
              for (const identity of batch) observations.push({ identity, provider, externalId: identity.vndbId!, report: reports.get(identity.igdbId) ?? null,
                nextCheckAt: new Date(Date.now() + 7 * DAY), invalidate: reports.has(identity.igdbId) && reports.get(identity.igdbId) === null });
              await flush();
            }
          } else {
            for (const identity of due) {
              result.attempted++;
              if (result.attempted === 1 || result.attempted % 25 === 0) progress(`ifdb checking game=${result.attempted} of ${due.length}`);
              const report = await this.client.ifdb(identity, deadline);
              observations.push({ identity, provider, externalId: identity.ifdbId!, report, nextCheckAt: new Date(Date.now() + 7 * DAY) });
              if (observations.length >= 25) await flush();
            }
          }
        }
        result.status = result.attempted ? "complete" : provider !== "backloggd" && !identities.length ? "identity_unavailable" : "cached";
      } catch (error) {
        const sourceError = error instanceof CompletionSourceError ? error : new CompletionSourceError(error instanceof Error && /^[a-z0-9_]{1,64}$/.test(error.message) ? error.message : "completion_source_invalid");
        await this.repository.failure(provider, sourceError.code, sourceError.retryAt);
        result.status = sourceError.code;
      }
      await flush();
      progress(`${provider} status=${result.status} attempted=${result.attempted} accepted=${result.accepted} added=${result.added}`);
      sources.push(result);
    }
    return { identityCount: identities.length, sources };
  }

  private async identities(deadline: number): Promise<CompletionIdentity[]> {
    const state = await this.repository.state("identity-map");
    const cached = Array.isArray(state?.identityMap) ? state.identityMap as CompletionIdentity[] : [];
    if (state?.cooldownUntil && state.cooldownUntil.getTime() > Date.now()) return cached;
    if (state?.mapCheckedAt && state.mapCheckedAt.getTime() > Date.now() - 7 * DAY) return cached;
    try {
      const mappings = await this.client.identities(deadline);
      if (!mappings.length || mappings.length > MAX_IDENTITIES) throw new Error("completion_identity_map_incomplete");
      const catalog = await this.repository.catalogSlugs([...new Set(mappings.map((row) => row.slug))]);
      const canonical = new Map<number, string>();
      for (let offset = 0; offset < catalog.length; offset += 500) {
        for (const row of await this.client.canonical(catalog.slice(offset, offset + 500).map((game) => game.igdbId), deadline)) canonical.set(row.igdbId, row.slug);
      }
      if (catalog.length && !canonical.size) throw new Error("completion_identity_canonical_unavailable");
      const bySlug = new Map(catalog.filter((row) => canonical.get(row.igdbId) === row.slug).map((row) => [row.slug, row.igdbId]));
      const identities = mappings.flatMap((row) => {
        const igdbId = bySlug.get(row.slug);
        return igdbId ? [{ ...row, igdbId }] : [];
      });
      await this.repository.saveMap(identities, new Date());
      return identities;
    } catch (error) {
      const sourceError = error instanceof CompletionSourceError ? error : new CompletionSourceError("completion_identity_map_failed");
      await this.repository.failure("identity-map", sourceError.code, sourceError.retryAt);
      return cached;
    }
  }
}
