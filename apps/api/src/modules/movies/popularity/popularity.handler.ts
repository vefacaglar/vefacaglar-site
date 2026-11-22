import { injectable } from "tsyringe";
import { MovieAudienceService } from "./audience.service";
@injectable()
export class RefreshMoviePopularityHandler {
  constructor(private readonly service: MovieAudienceService) {}
  handle() { return this.service.refresh(); }
}
