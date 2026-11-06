import { inject, injectable } from "tsyringe";
import { assertCompleteProjection, candidateSourceDays } from "./wikipedia-interest";
import { MOVIE_POPULARITY_REPOSITORY, WIKIPEDIA_INTEREST_CLIENT, MovieInterestSourceError, type IMoviePopularityRepository, type IWikipediaInterestClient } from "./popularity.types";
export type RefreshMoviePopularityResult = {
  status: "published" | "unchanged" | "delayed" | "cooldown"; sourceDate: string | null;
  observedMovieCount: number | null; articleCount: number | null; requests: number; durationMs: number; nextRetryAt: string | null;
};
@injectable()
export class MoviePopularityService {
  constructor(@inject(MOVIE_POPULARITY_REPOSITORY) private readonly repo: IMoviePopularityRepository,
    @inject(WIKIPEDIA_INTEREST_CLIENT) private readonly client: IWikipediaInterestClient) {}
  async refresh(): Promise<RefreshMoviePopularityResult> {
    const started = Date.now();
    const state = await this.repo.state();
    const base = { sourceDate: state.sourceDate, observedMovieCount: state.observedMovieCount, articleCount: state.articleCount, requests: 0, durationMs: 0, nextRetryAt: null };
    if (!candidateSourceDays(state.sourceDate).length) return { ...base, status: "unchanged" };
    const shared = await this.repo.wikidataCooldown();
    const until = new Date(Math.max(state.cooldownUntil?.getTime() ?? 0, shared?.getTime() ?? 0));
    if (until.getTime() > Date.now()) return { ...base, status: "cooldown", nextRetryAt: until.toISOString() };
    let collected;
    try { collected = await this.client.collect(state.sourceDate, { beforeWikidata: () => this.repo.wikidataCooldown() }); }
    catch (error) {
      const failure = error instanceof MovieInterestSourceError ? error : new MovieInterestSourceError("aqs", "movie_interest_source_failed");
      await this.repo.recordFailure(failure.code, failure.provider, failure.retryAt);
      throw new Error(`Movie interest refresh failed: ${failure.code}`);
    }
    if (collected.status === "delayed") return { ...base, status: "delayed", requests: collected.requests, durationMs: Date.now() - started };
    // This is the only publication call. A partial source/mapping response never reaches it.
    assertCompleteProjection(collected.projection);
    const saved = await this.repo.publish(collected.projection);
    return { status: saved.status, sourceDate: collected.projection.sourceDate, observedMovieCount: saved.observedMovieCount,
      articleCount: collected.projection.articleCount, requests: collected.projection.requests, durationMs: Date.now() - started, nextRetryAt: null };
  }
}
