import { injectable } from "tsyringe";
import { MovieSyncService, type MovieSyncOptions } from "./movie-sync.service";
@injectable()
export class SyncMoviesHandler {
  constructor(private readonly service: MovieSyncService) {}
  handle(options: MovieSyncOptions = {}) { return this.service.synchronize(options); }
}
