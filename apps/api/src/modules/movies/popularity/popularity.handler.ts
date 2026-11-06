import { injectable } from "tsyringe";
import { MoviePopularityService } from "./popularity.service";
@injectable()
export class RefreshMoviePopularityHandler {
  constructor(private readonly service: MoviePopularityService) {}
  handle() { return this.service.refresh(); }
}
