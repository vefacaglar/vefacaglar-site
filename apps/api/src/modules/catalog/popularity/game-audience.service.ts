import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "../catalog.tokens";
import type { IGamesRepository, PopularitySource, GameWikipediaObservation } from "../games.repository.interface";
import { IGDB_CLIENT } from "../import/import.tokens";
import type { IIgdbClient, PopularityPrimitive, GameRankingMetadata } from "../import/import.types";
import { popularityCandidateIds } from "./popularity-candidates";
import { completedGameAudienceDay, freshGameAudience } from "./wikipedia-audience";
import { GameAudienceSourceError, GameWikipediaAudienceClient } from "./wikipedia-audience.client";
import type { WikipediaAudience } from "./popularity-score";

const MAX_ARTICLES = 250;
const REQUEST_BUDGET_MS = 240_000;
export type GameAudienceResult = {
  metadata: Map<number, GameRankingMetadata>;
  audience: Map<number, WikipediaAudience>;
  candidateCount: number;
  requests: number;
  status: "complete" | "partial" | "unavailable";
};

/** Provider work is restricted to a fixed current-interest cohort, with a daily durable cache. */
@injectable()
export class GameAudienceService {
  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(IGDB_CLIENT) private readonly igdb: IIgdbClient,
    private readonly wikipedia: GameWikipediaAudienceClient
  ) {}

  async prepare(primitives: PopularityPrimitive[], sources: PopularitySource[], now = new Date()): Promise<GameAudienceResult> {
    const byIgdbId = new Map(sources.map((source) => [source.igdbId, source]));
    const candidateIds = popularityCandidateIds(primitives).filter((id) => byIgdbId.has(id));
    const metadata = new Map((await this.igdb.listRankingMetadata(candidateIds, AbortSignal.timeout(25_000))).map((row) => [row.igdbId, row]));
    const cached = new Map((await this.gamesRepo.findWikipediaInterest(candidateIds.map((id) => byIgdbId.get(id)!.id))).map((row) => [row.gameId, row]));
    const cooldown = await this.gamesRepo.getWikipediaInterestCooldown();
    const expectedDay = completedGameAudienceDay(now);
    const signal = AbortSignal.timeout(REQUEST_BUDGET_MS);
    const audience = new Map<number, WikipediaAudience>();
    const fetched = new Map<string, WikipediaAudience | null>();
    const writes: GameWikipediaObservation[] = [];
    let requests = 0;
    let incomplete = false;
    let stopped = cooldown !== null && cooldown > now;
    for (const id of candidateIds) {
      const source = byIgdbId.get(id)!;
      const previous = cached.get(source.id);
      const article = metadata.get(id)?.wikipediaArticle ?? previous?.article;
      if (!article) continue;
      if (previous && previous.article === article && freshGameAudience(previous, now)) audience.set(id, previous);
      if (previous?.article === article && previous.sourceDate === expectedDay && freshGameAudience(previous, now)) continue;
      if (!fetched.has(article) && (stopped || signal.aborted || requests >= MAX_ARTICLES)) { incomplete = true; continue; }
      if (!fetched.has(article)) {
        requests++;
        try { fetched.set(article, await this.wikipedia.fetch(article, expectedDay, signal)); }
        catch (error) {
          if (!(error instanceof GameAudienceSourceError)) throw error;
          incomplete = true;
          stopped = true;
          fetched.set(article, null);
          if (error.retryAt) await this.gamesRepo.setWikipediaInterestCooldown(error.retryAt);
        }
      }
      const observation = fetched.get(article);
      if (!observation) { incomplete = true; continue; }
      audience.set(id, observation);
      writes.push({ gameId: source.id, article, ...observation, fetchedAt: now });
    }
    // Only complete article windows replace rows; database failures must fail the job.
    await this.gamesRepo.writeWikipediaInterest(writes);
    return { metadata, audience, candidateCount: candidateIds.length, requests,
      status: incomplete ? (audience.size ? "partial" : "unavailable") : "complete" };
  }
}
