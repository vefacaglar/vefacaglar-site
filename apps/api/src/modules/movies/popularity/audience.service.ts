import { inject, injectable } from "tsyringe";
import { MoviePopularityService } from "./popularity.service";
import { utcDay } from "./wikipedia-interest";
import { audienceContribution, audienceSourceFresh, audienceSummary, fuseAudience } from "./audience-ranking";
import { MOVIE_AUDIENCE_CLIENT, MOVIE_AUDIENCE_REPOSITORY, MovieAudienceError, type AudienceSnapshot,
  type IMovieAudienceClient, type IMovieAudienceRepository } from "./audience.types";

@injectable()
export class MovieAudienceService {
  constructor(@inject(MOVIE_AUDIENCE_REPOSITORY) private readonly repo: IMovieAudienceRepository,
    @inject(MOVIE_AUDIENCE_CLIENT) private readonly client: IMovieAudienceClient,
    private readonly wikipedia: MoviePopularityService) {}

  private async beforeWikidata() {
    const until = await this.repo.wikidataCooldown();
    if (until && until.getTime() > Date.now()) throw new MovieAudienceError("wikidata_shared_cooldown", until, true);
  }
  private async resolve(snapshot: AudienceSnapshot, now: Date) {
    const provider = snapshot.provider;
    if (provider === "wikipedia") return snapshot;
    const cache = await this.repo.identities(provider, snapshot.items.map((item) => item.externalId), new Date(now.getTime() - 90 * 86_400_000));
    const identities = new Map(cache.filter((row) => row.wikidataId || row.checkedAt.getTime() > now.getTime() - 86_400_000)
      .map((row) => [row.externalId, row.wikidataId]));
    const missing = snapshot.items.filter((item) => !identities.has(item.externalId));
    if (missing.length) {
      const resolved = provider === "tmdb"
        ? await this.client.tmdbIdentities(missing.map((item) => item.externalId), () => this.beforeWikidata())
        : await this.client.netflixIdentities(missing, () => this.beforeWikidata());
      if (resolved.size !== missing.length || missing.some((item) => !resolved.has(item.externalId))) throw new MovieAudienceError("incomplete_audience_identity_mapping", undefined, true);
      await this.repo.saveIdentities([...resolved].map(([externalId, wikidataId]) => ({ provider, externalId, wikidataId, checkedAt: now })));
      for (const [externalId, wikidataId] of resolved) identities.set(externalId, wikidataId);
    }
    const items = snapshot.items.map((item) => ({ ...item, wikidataId: identities.get(item.externalId) ?? undefined }));
    if (!items.some((item) => !!item.wikidataId)) throw new MovieAudienceError(`${provider}_no_verified_film_matches`);
    return { ...snapshot, items };
  }
  async refresh() {
    const started = Date.now(), now = new Date();
    const before = await this.repo.sources();
    const failures: { provider: string; code: string }[] = [];
    for (const provider of ["tmdb", "netflix"] as const) {
      const current = before.find((source) => source.provider === provider);
      if (current?.cooldownUntil && current.cooldownUntil.getTime() > now.getTime()) continue;
      if (provider === "tmdb" && current?.snapshot?.sourceDate === utcDay(now) && audienceSourceFresh(current.snapshot, now)) continue;
      try {
        const incoming = provider === "tmdb" ? await this.client.tmdb(now) : await this.client.netflix(now);
        if (!audienceSourceFresh(incoming, now)) throw new MovieAudienceError(`${provider}_stale_source`);
        const snapshot = await this.resolve(incoming, now);
        await this.repo.accept(snapshot);
      } catch (error) {
        const failure = error instanceof MovieAudienceError ? error : new MovieAudienceError(`${provider}_source_failed`);
        failures.push({ provider, code: failure.code });
        await this.repo.failure(provider, failure.code, failure.retryAt);
        if (failure.wikidata) await this.repo.deferWikidata(failure.retryAt);
      }
    }
    const availableCore = (await this.repo.sources()).some((source) => source.provider !== "wikipedia"
      && source.snapshot && audienceSourceFresh(source.snapshot, new Date()) && source.snapshot.items.some((item) => !!item.wikidataId));
    if (!availableCore) throw new Error("Movie popularity refresh failed: no_current_audience_evidence");
    const wikiState = before.find((source) => source.provider === "wikipedia");
    if (!wikiState?.cooldownUntil || wikiState.cooldownUntil.getTime() <= now.getTime()) {
      try {
        const result = await this.wikipedia.refresh();
        const snapshot = await this.repo.wikipedia();
        if (snapshot && audienceSourceFresh(snapshot, now)) await this.repo.accept(snapshot);
        if (result.status === "cooldown" || result.status === "delayed" || result.additionalErrorCode) {
          const code = result.additionalErrorCode ?? `wikipedia_${result.status}`;
          failures.push({ provider: "wikipedia", code });
          await this.repo.failure("wikipedia", code, new Date(result.nextRetryAt ?? Date.now() + 60_000));
        }
      } catch {
        failures.push({ provider: "wikipedia", code: "wikipedia_source_failed" });
        await this.repo.failure("wikipedia", "wikipedia_source_failed", new Date(Date.now() + 60_000));
      }
    }
    const after = await this.repo.sources();
    const snapshots = after.flatMap((source) => source.snapshot && audienceSourceFresh(source.snapshot, new Date()) ? [source.snapshot] : []);
    if (!snapshots.some((source) => source.provider !== "wikipedia" && source.items.some((item) => !!item.wikidataId))) {
      throw new Error("Movie popularity refresh failed: no_current_audience_evidence");
    }
    const scores = fuseAudience(snapshots);
    const saved = await this.repo.publish(snapshots, scores, now);
    const leaders = scores.slice(0, 10).map((row) => ({ ...row, contributions: snapshots.flatMap((source) => {
      const item = source.items.find((item) => item.wikidataId === row.wikidataId);
      return item ? [{ provider: source.provider, title: item.title, rank: item.rank, value: item.value,
        contribution: Math.round(audienceContribution(source.provider, item.rank) * 1_000_000) }] : [];
    }) }));
    return { ...saved, leaders, sourceDate: snapshots.map((source) => source.sourceDate).sort().at(-1) ?? null,
      sources: snapshots.map(audienceSummary), failures, durationMs: Date.now() - started };
  }
}
