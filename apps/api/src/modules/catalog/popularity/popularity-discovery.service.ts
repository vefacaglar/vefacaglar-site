import { injectable, inject } from "tsyringe";
import { IGDB_CLIENT } from "../import/import.tokens";
import type { IIgdbClient, PopularityPrimitive } from "../import/import.types";
import { ImportGameHandler } from "../import/import.handler";
import { POPULARITY_TYPE } from "./popularity-score";

const DISCOVERY_LIMITS = [
  { type: POPULARITY_TYPE.VISITS, limit: 200 },
  { type: POPULARITY_TYPE.PLAYING, limit: 50 },
  { type: POPULARITY_TYPE.STEAM_24H_PEAK_PLAYERS, limit: 50 },
];

/** Adds missing current leaders through the canonical, non-overwriting importer. */
@injectable()
export class PopularityDiscoveryService {
  constructor(
    @inject(IGDB_CLIENT) private readonly igdb: IIgdbClient,
    private readonly importer: ImportGameHandler
  ) {}

  async discover(primitives: PopularityPrimitive[], knownIds: Set<number>): Promise<number> {
    const candidateIds = new Set<number>();
    for (const { type, limit } of DISCOVERY_LIMITS) {
      const leaders = primitives.filter((row) => row.popularityType === type && row.value > 0)
        .sort((a, b) => b.value - a.value || a.igdbId - b.igdbId).slice(0, limit);
      for (const leader of leaders) {
        if (!knownIds.has(leader.igdbId)) candidateIds.add(leader.igdbId);
      }
    }
    if (candidateIds.size === 0) return 0;
    const games = await this.igdb.listGamesByIds([...candidateIds], AbortSignal.timeout(25_000));
    if (games.length === 0) return 0;
    const results = await this.importer.importPage(games);
    return results.filter((result) => result.status === "created").length;
  }
}
