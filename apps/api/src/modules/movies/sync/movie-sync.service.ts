import { inject, injectable } from "tsyringe";
import { MOVIES_REPOSITORY, WIKIDATA_ENTITY_CLIENT } from "../movies.tokens";
import type { IMoviesRepository, MovieCandidate } from "../movies.repository.interface";
import type { EntityLabels, IWikidataEntityClient, NormalizedMovie } from "../import/movie-source.types";
import { MOVIE_DISCOVERY_CLIENT, type IFilmDiscoveryClient } from "../import/wikidata-discovery.types";
import { normalizeMovie, supportingQids } from "../import/wikidata-normalizer";
import { COMMONS_POSTER_CLIENT, type ICommonsPosterClient } from "../artwork/commons-poster.client";
import { WIKIPEDIA_POSTER_CLIENT, type IWikipediaPosterClient } from "../artwork/wikipedia-poster.client";
import type { MoviePoster } from "../artwork/commons-poster";

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
    @inject(COMMONS_POSTER_CLIENT) private readonly posters: ICommonsPosterClient,
    @inject(WIKIPEDIA_POSTER_CLIENT) private readonly wikipedia: IWikipediaPosterClient) {}

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
    const artworkRoom = () => result.requests < maxRequests && Date.now() - started < budget - 1000;
    const artworkProviders = () => ({ commons: !state.artworkCooldownUntil || state.artworkCooldownUntil <= now(),
      wikipedia: !state.wikipediaArtworkCooldownUntil || state.wikipediaArtworkCooldownUntil <= now() });
    const attemptedArtwork = new Set<string>();
    const artworkCooldown = async (provider: "commons" | "wikipedia", error: unknown, affected: number) => {
      const retry = (error as { retryAfter?: unknown })?.retryAfter;
      const until = new Date(Math.max(Date.now() + 60_000, retry instanceof Date && Number.isFinite(retry.getTime()) ? retry.getTime() : 0));
      await save(provider === "commons" ? { artworkCooldownUntil: until } : { wikipediaArtworkCooldownUntil: until });
      result.posterFailures += affected;
    };
    const refreshPosters = async () => {
      type Status = "absent" | "negative" | "pending" | "transient" | "deferred";
      while (artworkRoom() && attemptedArtwork.size < 20) {
        const available = artworkProviders();
        const candidates = (await this.repo.posterCandidates(Math.min(5, 20 - attemptedArtwork.size), now(), available)).filter((row) => !attemptedArtwork.has(row.id));
        if (!candidates.length) break;
        for (const candidate of candidates) attemptedArtwork.add(candidate.id);
        const outcomes = new Map(candidates.map((row) => [row.id, {
          commons: (row.fileName ? available.commons ? "pending" : "transient" : "absent") as Status,
          wikipedia: (row.enwikiArticle ? available.wikipedia ? "pending" : "transient" : "absent") as Status,
          poster: null as MoviePoster | null,
        }]));
        const commons = candidates.filter((row) => row.fileName && available.commons);
        if (commons.length && artworkRoom()) {
          result.requests++;
          try {
            const fetched = await this.posters.fetchPosters(commons.map((row) => row.fileName!), signal);
            for (const candidate of commons) {
              const outcome = outcomes.get(candidate.id)!;
              outcome.commons = "negative";
              outcome.poster = fetched[candidate.fileName!] ?? null;
            }
            await save({ artworkCooldownUntil: null });
          } catch (error) {
            for (const candidate of commons) outcomes.get(candidate.id)!.commons = "transient";
            await artworkCooldown("commons", error, commons.length);
          }
        }
        const fallback = candidates.filter((row) => !outcomes.get(row.id)!.poster && row.enwikiArticle &&
          !(row.hasImage && (row.resolvedFrom ?? "commons") === "commons" && outcomes.get(row.id)!.commons === "transient"));
        if (fallback.length && available.wikipedia && artworkRoom() && maxRequests - result.requests >= 2) {
          result.requests++;
          try {
            const references = await this.wikipedia.resolveArticles(fallback.map((row) => ({ wikidataId: row.wikidataId, title: row.title, article: row.enwikiArticle! })), signal);
            for (const candidate of fallback) if (!references[candidate.wikidataId]) outcomes.get(candidate.id)!.wikipedia = "negative";
            const resolved = fallback.flatMap((row) => references[row.wikidataId] ? [references[row.wikidataId]!] : []);
            if (resolved.length && artworkRoom()) {
              result.requests++;
              const fetched = await this.wikipedia.fetchPosters(resolved, signal);
              for (const candidate of fallback) if (references[candidate.wikidataId]) {
                const outcome = outcomes.get(candidate.id)!;
                outcome.wikipedia = "negative";
                outcome.poster = fetched[candidate.wikidataId] ?? null;
              }
            }
            await save({ wikipediaArtworkCooldownUntil: null });
          } catch (error) {
            for (const candidate of fallback) if (outcomes.get(candidate.id)!.wikipedia === "pending") outcomes.get(candidate.id)!.wikipedia = "transient";
            await artworkCooldown("wikipedia", error, fallback.length);
          }
        }
        // Incomplete phases are retried; they are never negative-cached as absent artwork.
        for (const candidate of candidates) {
          const outcome = outcomes.get(candidate.id)!;
          for (const provider of ["commons", "wikipedia"] as const) if (outcome[provider] === "pending") outcome[provider] = "deferred";
          const complete = [outcome.commons, outcome.wikipedia].every((status) => status === "absent" || status === "negative");
          const previousInvalidated = candidate.hasImage && outcome[(candidate.resolvedFrom ?? "commons") as "commons" | "wikipedia"] === "negative";
          if (outcome.poster || complete || previousInvalidated) {
            if (await this.repo.persistPoster(candidate, outcome.poster, now())) {
              result.postersChecked++;
              if (outcome.poster) result.postersUpdated++;
              result.progressMade = true;
            }
          }
          if (!outcome.poster && !complete && ([outcome.commons, outcome.wikipedia].includes("transient") || previousInvalidated)) {
            const retries = [outcome.commons === "transient" ? state.artworkCooldownUntil : null,
              outcome.wikipedia === "transient" ? state.wikipediaArtworkCooldownUntil : null].filter((date): date is Date => !!date);
            await this.repo.markPosterFailure([candidate], retries.sort((a, b) => a.getTime() - b.getTime())[0] ?? new Date(Date.now() + 60_000));
          }
        }
      }
    };
    if (state.cooldownUntil && state.cooldownUntil > now()) {
      await refreshPosters();
      result.nextRunAt = state.cooldownUntil.toISOString();
      if (artworkRoom() && result.progressMade && (await this.repo.posterCandidates(1, now(), artworkProviders())).length) {
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
    const hydrate = async (candidates: MovieCandidate[], refresh: boolean, advanceCursor = refresh) => {
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
      if (refresh && advanceCursor) await save({ refreshCursor: candidates[candidates.length - 1].id });
    };

    // Existing notable seeds become usable before the much larger discovery projection.
    await hydrate(await this.repo.hydrationCandidates(5, now()), false);
    // Bootstrap exact sitelinks for visible/popular films and seeds even when
    // their source revision was checked recently. No public ordering changes.
    if (room() && remainingMovies() > 0) await hydrate(await this.repo.posterInputsCandidates(Math.min(50, remainingMovies()), now()), true, false);
    await refreshPosters();
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
      const postersRemaining = (await this.repo.posterCandidates(1, now(), artworkProviders())).length > 0;
      const posterInputsRemaining = (await this.repo.posterInputsCandidates(1, now())).length > 0;
      result.hasMore = !state.discoveryComplete || await this.repo.hasPendingWork(now()) || refreshRemaining || postersRemaining || posterInputsRemaining;
    }
    result.hasMore &&= result.progressMade;
    result.durationMs = Date.now() - started;
    return result;
  }
}
