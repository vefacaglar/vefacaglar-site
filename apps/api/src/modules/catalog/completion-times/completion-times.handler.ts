import { GAME_COMPLETION_SOURCES, type ICompletionSourcesRefresher } from "./completion-sources.types";
import { inject, injectable } from "tsyringe";
import { GAME_COMPLETION_TIMES_CLIENT, GAME_COMPLETION_TIMES_REPOSITORY,
  type IGameCompletionTimesClient, type IGameCompletionTimesRepository } from "./completion-times.types";
import { usableCompletionTimes } from "./completion-times-quality";

@injectable()
export class RefreshGameCompletionTimesHandler {
  constructor(
    @inject(GAME_COMPLETION_TIMES_CLIENT) private readonly source: IGameCompletionTimesClient,
    @inject(GAME_COMPLETION_TIMES_REPOSITORY) private readonly repository: IGameCompletionTimesRepository,
    @inject(GAME_COMPLETION_SOURCES) private readonly independentSources: ICompletionSourcesRefresher,
  ) {}

  async handle(progress: (message: string) => void = () => {}) {
    let igdbResult;
    let igdbError: unknown;
    try {
      progress("Collecting official IGDB completion snapshot");
      const rows = await this.source.collect();
      if (rows.length === 0) throw new Error("Empty IGDB completion times snapshot; retaining previous data");
      const usableRecords = rows.filter((row) => usableCompletionTimes(row) !== null).length;
      const coverage = await this.repository.publish(rows, new Date());
      progress(`IGDB snapshot published records=${rows.length} usable=${usableRecords} usableGames=${coverage.usableGames}`);
      igdbResult = { source: "IGDB", providerRecords: rows.length, usableRecords, ...coverage };
    } catch (error) { igdbError = error; }
    const independent = await this.independentSources.refresh(progress);
    if (igdbError) throw igdbError;
    return { ...igdbResult!, independent };
  }
}
