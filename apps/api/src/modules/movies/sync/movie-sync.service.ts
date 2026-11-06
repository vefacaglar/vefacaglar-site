import { inject, injectable } from "tsyringe";
import { MOVIES_REPOSITORY, WIKIDATA_ENTITY_CLIENT } from "../movies.tokens";
import type { IMoviesRepository, MovieCandidate } from "../movies.repository.interface";
import type { EntityLabels, IWikidataEntityClient, NormalizedMovie } from "../import/movie-source.types";
import { MOVIE_DISCOVERY_CLIENT, type IFilmDiscoveryClient } from "../import/wikidata-discovery.types";
import { normalizeMovie, supportingQids } from "../import/wikidata-normalizer";
import { COMMONS_POSTER_CLIENT, type ICommonsPosterClient } from "../artwork/commons-poster.client";

const DAY = 86_400_000;
export type MovieSyncOptions = { budgetMs?: number; maxRequests?: number; maxMovies?: number };
export type MovieSyncResult = { discovered: number; hydrated: number; refreshed: number; failed: number; imdbConflicts: number;
  labelsChecked: number; postersChecked: number; postersUpdated: number; posterFailures: number;
  requests: number; discoveryComplete: boolean; durationMs: number; hasMore: boolean; progressMade: boolean; nextRunAt: string | null };

/** Coordinates bounded, replayable windows across Wikidata and the local catalog. */
@injectable()
export class MovieSyncService {
  constructor(@inject(MOVIES_REPOSITORY) private readonly repo: IMoviesRepository,
    @inject(WIKIDATA_ENTITY_CLIENT) private readonly client: IWikidataEntityClient,
    @inject(MOVIE_DISCOVERY_CLIENT) private readonly discovery: IFilmDiscoveryClient,
    @inject(COMMONS_POSTER_CLIENT) private readonly posters: ICommonsPosterClient) {}

  async synchronize(options: MovieSyncOptions = {}): Promise<MovieSyncResult> {
    const started = Date.now();
    const budget = Math.max(1000, Math.min(180_000, options.budgetMs ?? 150_000));
    const maxRequests = Math.max(1, Math.min(60, options.maxRequests ?? 40));
    const maxMovies = Math.max(5, Math.min(1000, options.maxMovies ?? 500));
    const signal = AbortSignal.timeout(budget);
    const result: MovieSyncResult = { discovered: 0, hydrated: 0, refreshed: 0, failed: 0, imdbConflicts: 0,
      labelsChecked: 0, postersChecked: 0, postersUpdated: 0, posterFailures: 0,
      requests: 0, discoveryComplete: false, durationMs: 0, hasMore: false, progressMade: false, nextRunAt: null };
    const initialized = await this.repo.ensureSourceAndSeeds();
    let state = initialized.state;
    result.progressMade = initialized.inserted > 0;
    let providerStopped = false;
    const now = () => new Date();
    const room = () => !providerStopped && result.requests < maxRequests && Date.now() - started < budget - 1000;
    const remainingMovies = () => maxMovies - result.hydrated - result.refreshed - result.failed;
    const save = async (patch: Parameters<IMoviesRepository["saveSourceState"]>[0]) => {
      await this.repo.saveSourceState(patch);
      state = { ...state, ...patch };
    };
    const cooldown = async (error: unknown) => {
      providerStopped = true;
      const retry = (error as { retryAfter?: unknown })?.retryAfter;
      const retryAt = retry instanceof Date && Number.isFinite(retry.getTime()) ? retry : new Date(Date.now() + 60_000);
      const until = new Date(Math.max(Date.now() + 30_000, retryAt.getTime()));
      await save({ cooldownUntil: until, failureCount: state.failureCount + 1 });
      result.progressMade = true;
    };
    const artworkRoom = () => result.requests < maxRequests && Date.now() - started < budget - 1000 &&
      (!state.artworkCooldownUntil || state.artworkCooldownUntil <= now());
    const refreshPosters = async () => {
      while (artworkRoom() && result.postersChecked + result.posterFailures < 20) {
        const candidates = await this.repo.posterCandidates(Math.min(5, 20 - result.postersChecked), now());
        if (!candidates.length) break;
        result.requests++;
        let fetched;
        try { fetched = await this.posters.fetchPosters(candidates.map((row) => row.fileName), signal); }
        catch (error) {
          const retry = (error as { retryAfter?: unknown })?.retryAfter;
          const retryAfter = new Date(Math.max(Date.now() + 60_000, retry instanceof Date && Number.isFinite(retry.getTime()) ? retry.getTime() : 0));
          // Commons failures preserve valid artwork and do not stop Wikidata discovery.
          await this.repo.markPosterFailure(candidates, retryAfter);
          await save({ artworkCooldownUntil: retryAfter });
          result.posterFailures += candidates.length;
          break;
        }
        for (const candidate of candidates) {
          const poster = fetched[candidate.fileName];
          await this.repo.persistPoster(candidate, poster, now());
          result.postersChecked++;
          if (poster) result.postersUpdated++;
          result.progressMade = true;
        }
        await save({ artworkCooldownUntil: null });
      }
    };
    if (state.cooldownUntil && state.cooldownUntil > now()) {
      await refreshPosters();
      result.nextRunAt = state.cooldownUntil.toISOString();
      if (artworkRoom() && result.progressMade && (await this.repo.posterCandidates(1, now())).length) {
        result.hasMore = true;
        result.nextRunAt = null;
      }
      result.discoveryComplete = state.discoveryComplete;
      result.durationMs = Date.now() - started;
      // A duplicate/manual run during the same cooldown does not spawn a chain.
      return result;
    }
    const allowRequest = async () => {
      const latest = await this.repo.sourceState();
      if (latest.cooldownUntil && latest.cooldownUntil > now()) {
        providerStopped = true;
        state = { ...state, cooldownUntil: latest.cooldownUntil };
        return false;
      }
      return true;
    };
    let successfulRequest = false;
    const labelsFor = async (qids: string[], requestLimit: number): Promise<EntityLabels> => {
      const cached = await this.repo.findLabels(qids);
      const labels: EntityLabels = Object.fromEntries(Object.entries(cached).map(([qid, entry]) => [qid, entry.name]));
      const missing = qids.filter((qid) => !cached[qid] || cached[qid].checkedAt.getTime() < Date.now() - 7 * DAY);
      for (let offset = 0, calls = 0; offset < missing.length && calls < requestLimit && room(); offset += 50, calls++) {
        const batch = missing.slice(offset, offset + 50);
        if (!await allowRequest()) break;
        result.requests++;
        let fetched: EntityLabels;
        try { fetched = await this.client.fetchLabels(batch, { signal }); successfulRequest = true; }
        catch (error) { await cooldown(error); break; }
        await this.repo.writeLabels(fetched, now());
        Object.assign(labels, fetched);
        result.labelsChecked += Object.keys(fetched).length;
        result.progressMade = true;
      }
      return labels;
    };
    const hydrate = async (candidates: MovieCandidate[], refresh: boolean) => {
      candidates = candidates.slice(0, remainingMovies());
      if (!candidates.length || !room() || !await allowRequest()) return;
      result.requests++;
      let entities: Record<string, unknown>;
      try { entities = await this.client.fetchEntities(candidates.map((row) => row.wikidataId), { signal }); successfulRequest = true; }
      catch (error) { await cooldown(error); return; }
      const valid: NormalizedMovie[] = [];
      for (const candidate of candidates) {
        try {
          const movie = normalizeMovie(entities[candidate.wikidataId], candidate.wikidataId);
          if (movie.sourceRevision !== null && candidate.sourceRevision !== null && movie.sourceRevision < candidate.sourceRevision) throw new Error("stale_source_revision");
          valid.push(movie);
        }
        catch {
          await this.repo.markEntityFailure(candidate.wikidataId, "incomplete_or_invalid_entity", now());
          result.failed++;
          result.progressMade = true;
        }
      }
      // Labels are supporting data: a provider outage here never discards validated claims.
      const qids = [...new Set(valid.flatMap(supportingQids))];
      await labelsFor(qids, refresh ? 1 : 2);
      for (const movie of valid) {
        const outcome = await this.repo.persistMovie(movie, now());
        if (outcome === "imdb_conflict") result.imdbConflicts++;
        if (refresh) result.refreshed++; else result.hydrated++;
        result.progressMade = true;
      }
      if (refresh) await save({ refreshCursor: candidates[candidates.length - 1].id });
    };

    // Existing notable seeds become usable before the much larger discovery projection.
    await hydrate(await this.repo.hydrationCandidates(5, now()), false);
    const discoveryDue = !state.discoveryComplete || !state.nextDiscoveryAt || state.nextDiscoveryAt <= now();
    if (discoveryDue && room() && await allowRequest()) {
      result.requests++;
      let projection;
      try {
        projection = await this.discovery.discover(async (qids) => {
          if (signal.aborted) throw new Error("movie_window_expired");
          let inserted: number;
          try { inserted = await this.repo.insertDiscovered(qids); }
          catch { throw new Error("movie_database_write_failed"); }
          result.discovered += inserted;
          result.progressMade ||= inserted > 0;
        }, { signal, maxRequests: 1 });
      } catch (error) {
        // Database failures must fail the job, rather than masquerade as provider cooldowns.
        if (error instanceof Error && error.message === "movie_database_write_failed") throw error;
        await cooldown(error);
      }
      if (projection?.complete) {
        successfulRequest = true;
        await save({ discoveryComplete: true, discoveryStrategy: projection.strategy,
          discoveryCycle: state.discoveryCycle + 1, nextDiscoveryAt: new Date(Date.now() + DAY) });
        result.progressMade = true;
      }
    }
    // Reserve capacity for daily revision rotation even while bootstrap is unfinished.
    let refreshAvailable = false;
    if (room() && remainingMovies() > 0) {
      const refresh = await this.repo.refreshCandidates(state.refreshCursor, 50, new Date(Date.now() - DAY), now());
      if (refresh.length) {
        refreshAvailable = true;
        await hydrate(refresh, true);
      }
      else if (state.refreshCursor) {
        await save({ refreshCursor: null });
        result.progressMade = true;
      }
    }
    await refreshPosters();
    while (room() && remainingMovies() > 0) {
      const candidates = await this.repo.hydrationCandidates(Math.min(50, remainingMovies()), now());
      if (!candidates.length) break;
      await hydrate(candidates, false);
    }
    // Once bootstrap has caught up, use the rest of the bounded window for
    // rotating existing films instead of limiting every successor to 50 rows.
    while (refreshAvailable && room() && remainingMovies() > 0) {
      const candidates = await this.repo.refreshCandidates(state.refreshCursor, Math.min(50, remainingMovies()), new Date(Date.now() - DAY), now());
      if (!candidates.length) break;
      await hydrate(candidates, true);
    }
    await refreshPosters();
    // Rotate stale labels as well as unresolved references; no per-person request fanout.
    if (room()) {
      const unresolved = await this.repo.labelRefreshCandidates(50, new Date(Date.now() - 7 * DAY));
      if (unresolved.length) await labelsFor(unresolved, 1);
    }
    if (successfulRequest && !providerStopped) await save({ cooldownUntil: null, failureCount: 0, lastSuccessAt: now() });
    result.discoveryComplete = state.discoveryComplete;
    if (providerStopped) {
      // Stop automatic retry chains after three consecutive unavailable windows. Daily runs can retry later.
      result.hasMore = state.failureCount <= 3;
      result.nextRunAt = state.cooldownUntil?.toISOString() ?? null;
    } else {
      const refreshRemaining = (await this.repo.refreshCandidates(state.refreshCursor, 1, new Date(Date.now() - DAY), now())).length > 0;
      const postersRemaining = (!state.artworkCooldownUntil || state.artworkCooldownUntil <= now()) &&
        (await this.repo.posterCandidates(1, now())).length > 0;
      result.hasMore = !state.discoveryComplete || await this.repo.hasPendingWork(now()) || refreshRemaining || postersRemaining;
    }
    result.hasMore &&= result.progressMade;
    result.durationMs = Date.now() - started;
    return result;
  }
}
