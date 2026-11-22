import { injectable, inject } from "tsyringe";
import { IGDB_CLIENT } from "../import/import.tokens";
import type { IIgdbClient, PopularityPrimitive } from "../import/import.types";
import { ImportGameHandler } from "../import/import.handler";
import { popularityCandidateIds } from "./popularity-candidates";

/** Adds missing current leaders through the canonical, non-overwriting importer. */
@injectable()
export class PopularityDiscoveryService {
  constructor(
    @inject(IGDB_CLIENT) private readonly igdb: IIgdbClient,
    private readonly importer: ImportGameHandler
  ) {}

  async discover(primitives: PopularityPrimitive[], knownIds: Set<number>): Promise<number> {
    const candidateIds = new Set(popularityCandidateIds(primitives).filter((id) => !knownIds.has(id)));
    if (candidateIds.size === 0) return 0;
    const games = await this.igdb.listGamesByIds([...candidateIds], AbortSignal.timeout(25_000));
    if (games.length === 0) return 0;
    const results = await this.importer.importPage(games);
    return results.filter((result) => result.status === "created").length;
  }
}
