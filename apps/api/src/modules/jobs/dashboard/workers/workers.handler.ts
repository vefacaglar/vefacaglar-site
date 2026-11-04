import { inject, injectable } from "tsyringe";
import { JOBS_REPOSITORY } from "../../jobs.tokens";
import type { IJobsRepository } from "../../jobs.repository.interface";
import { toWorker } from "../../jobs.mapper";
import { ListWorkersResponse } from "./workers.schema";

@injectable()
export class ListWorkersHandler {
  constructor(@inject(JOBS_REPOSITORY) private readonly jobsRepo: IJobsRepository) {}

  async handle(): Promise<ListWorkersResponse> {
    const rows = await this.jobsRepo.listWorkers();
    const now = new Date();
    return { items: rows.map((row) => toWorker(row, now)) };
  }
}
