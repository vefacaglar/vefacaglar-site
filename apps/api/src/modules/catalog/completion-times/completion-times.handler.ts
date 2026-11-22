import { inject, injectable } from "tsyringe";
import { GAME_COMPLETION_TIMES_CLIENT, GAME_COMPLETION_TIMES_REPOSITORY,
  type IGameCompletionTimesClient, type IGameCompletionTimesRepository } from "./completion-times.types";
import { usableCompletionTimes } from "./completion-times-quality";

@injectable()
export class RefreshGameCompletionTimesHandler {
  constructor(
    @inject(GAME_COMPLETION_TIMES_CLIENT) private readonly source: IGameCompletionTimesClient,
    @inject(GAME_COMPLETION_TIMES_REPOSITORY) private readonly repository: IGameCompletionTimesRepository,
  ) {}

  async handle() {
    const rows = await this.source.collect();
    if (rows.length === 0) throw new Error("Empty IGDB completion times snapshot; retaining previous data");
    const usableRecords = rows.filter((row) => usableCompletionTimes(row) !== null).length;
    const coverage = await this.repository.publish(rows, new Date());
    return { source: "IGDB", providerRecords: rows.length, usableRecords, ...coverage };
  }
}
