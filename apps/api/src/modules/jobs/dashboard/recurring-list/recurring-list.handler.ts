import { inject, injectable } from "tsyringe";
import { JOBS_REPOSITORY } from "../../jobs.tokens";
import type { IJobsRepository } from "../../jobs.repository.interface";
import { toJobSummary, toRecurringJob } from "../../jobs.mapper";
import { describeJobType, isKnownJobType, JOB_TYPES } from "../../job-types";
import { ListRecurringJobsResponse } from "./recurring-list.schema";

/** Registered jobs (with or without cron) plus their live state for the dashboard. */
@injectable()
export class ListRecurringJobsHandler {
  constructor(@inject(JOBS_REPOSITORY) private readonly jobsRepo: IJobsRepository) {}

  async handle(): Promise<ListRecurringJobsResponse> {
    const rows = await this.jobsRepo.listRecurringOverview();
    return {
      items: rows.map(({ recurring, currentJob, lastJob }) => ({
        ...toRecurringJob(recurring),
        description: describeJobType(recurring.type),
        concurrencyKey: isKnownJobType(recurring.type) ? JOB_TYPES[recurring.type].concurrencyKey(recurring.payload) : null,
        currentJob: currentJob ? toJobSummary(currentJob) : null,
        lastJob: lastJob ? toJobSummary(lastJob) : null,
      })),
    };
  }
}
