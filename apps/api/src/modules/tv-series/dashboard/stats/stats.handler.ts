import { inject, injectable } from "tsyringe";
import { TV_DASHBOARD_REPOSITORY, type ITvDashboardRepository } from "../tv-dashboard.repository.interface";
@injectable()
export class GetTvDashboardStatsHandler {
  constructor(@inject(TV_DASHBOARD_REPOSITORY) private readonly repo: ITvDashboardRepository) {}
  handle() { return this.repo.stats(); }
}
