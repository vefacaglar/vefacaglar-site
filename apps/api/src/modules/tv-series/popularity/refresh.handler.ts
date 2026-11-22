import { inject, injectable } from "tsyringe";
import { TvPopularityClient } from "./tv-popularity.client";
import { parseTvIdentities, rankTvPopularity } from "./tv-popularity-ranking";
import { TV_POPULARITY_REPOSITORY, type ITvPopularityRepository } from "./tv-popularity.types";
@injectable()
export class RefreshTvPopularityHandler {
  constructor(private readonly client: TvPopularityClient, @inject(TV_POPULARITY_REPOSITORY) private readonly repository: ITvPopularityRepository) {}
  async handle(progress: (message: string) => void = () => {}) {
    const deadline = Date.now() + 150000, now = new Date(), state = await this.repository.state();
    if (state.cooldownUntil && state.cooldownUntil > now) throw new Error("tv_popularity_cooldown_active");
    try {
      let identities;
      if (state.identitiesCheckedAt && state.identitiesCheckedAt.getTime() > now.getTime() - 7 * 86400_000) identities = parseTvIdentities(state.identityMap);
      else {
        progress("Fetching exact Wikidata TVmaze and TMDB identities");
        identities = await this.client.identities(deadline);
        await this.repository.identities(identities, now);
      }
      progress(`Verified identity mappings=${identities.length}`);
      const tmdb = await this.client.tmdb(now, deadline);
      progress(`TMDB complete daily export rows=${tmdb.values.size} date=${tmdb.source.sourceDate}`);
      let wiki = new Map<string, number>();
      const sources = [tmdb.source];
      try {
        const recent = await this.client.wikipedia(now, deadline);
        wiki = recent.values; sources.push(recent.source);
        progress(`Wikipedia complete seven-day top-page window articles=${wiki.size} start=${recent.source.windowStart} end=${recent.source.sourceDate}`);
      } catch { progress("Wikipedia recent top-page window unavailable; publishing the complete TMDB daily snapshot only"); }
      const scores = rankTvPopularity(identities, tmdb.values, wiki);
      const wikiMatches = identities.filter((row) => row.article && wiki.has(row.article) && tmdb.values.has(row.tmdbId)).length;
      const published = await this.repository.publish({ scores, sources, providerRows: tmdb.values.size, mapped: scores.length, wikiMatches }, now);
      return { ...published, providerRows: tmdb.values.size, mapped: scores.length, wikiMatches, sources: sources.map((source) => source.provider).join(",") };
    } catch (error) {
      await this.repository.cooldown(new Date(Date.now() + 60000));
      throw error;
    }
  }
}
