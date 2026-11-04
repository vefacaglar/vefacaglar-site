import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { JOBS_REPOSITORY } from "../../jobs.tokens";
import type { IJobsRepository } from "../../jobs.repository.interface";
import { toJobSummary } from "../../jobs.mapper";
import { prepareJob } from "../../job-types";
import { ConflictError, NotFoundError } from "../../../../shared/http-errors";
import { RunRecurringJobParams, RunRecurringJobResponse } from "./recurring-run.schema";

/** Enqueues a recurring definition right now; its schedule (`next_run_at`) is left untouched. */
@injectable()
export class RunRecurringJobHandler {
  constructor(@inject(JOBS_REPOSITORY) private readonly jobsRepo: IJobsRepository) {}

  async handle(request: FastifyRequest<{ Params: RunRecurringJobParams }>): Promise<RunRecurringJobResponse> {
    const recurring = await this.jobsRepo.findRecurringById(request.params.id);
    if (!recurring) {
      throw new NotFoundError("err_recurring_job_not_found");
    }

    const { type, payload, concurrencyKey } = prepareJob(recurring.type, recurring.payload);

    const job = await this.jobsRepo.enqueue({
      type,
      payload,
      concurrencyKey,
      recurringJobId: recurring.id,
      createdBy: request.user?.id ?? null,
    });
    if (!job) {
      throw new ConflictError("err_job_already_active");
    }
    return toJobSummary(job);
  }
}
