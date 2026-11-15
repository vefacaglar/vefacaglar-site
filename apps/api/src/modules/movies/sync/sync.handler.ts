import { injectable } from "tsyringe";
import { MovieSyncService, type MovieSyncOptions, type MovieSyncResult } from "./movie-sync.service";

// Leave room for the last 150-second window to finish before the worker's
// 50-minute hard deadline and the next hourly schedule.
const START_WINDOW_LIMIT_MS = 42 * 60_000;
const MAX_WINDOWS = 100;
export type MovieSyncStopReason = "complete" | "no_progress" | "cooldown" | "safety_limit";

@injectable()
export class SyncMoviesHandler {
  constructor(private readonly service: MovieSyncService) {}
  handle(options: MovieSyncOptions = {}) { return this.service.synchronize(options); }

  /** Run bounded, durably committed windows inside one visible worker job. */
  async handleRun(onWindow: (result: MovieSyncResult, window: number) => void = () => {}): Promise<MovieSyncStopReason> {
    const started = performance.now();
    for (let window = 1; window <= MAX_WINDOWS; window++) {
      if (window > 1 && performance.now() - started >= START_WINDOW_LIMIT_MS) return "safety_limit";
      const result = await this.handle();
      onWindow(result, window);
      if (result.nextRunAt) return "cooldown";
      if (!result.progressMade) return "no_progress";
      if (!result.hasMore) return "complete";
    }
    return "safety_limit";
  }
}
