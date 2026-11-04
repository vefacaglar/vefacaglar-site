import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { JOBS_REPOSITORY } from "../../jobs.tokens";
import type { IJobsRepository } from "../../jobs.repository.interface";
import { toJobSummary } from "../../jobs.mapper";
import { prepareJob } from "../../job-types";
import { ConflictError } from "../../../../shared/http-errors";
import { EnqueueJobRequest, EnqueueJobResponse } from "./enqueue.schema";

@injectable()
export class EnqueueJobHandler {
  constructor(@inject(JOBS_REPOSITORY) private readonly jobsRepo: IJobsRepository) {}

  async handle(request: FastifyRequest<{ Body: EnqueueJobRequest }>): Promise<EnqueueJobResponse> {
    const { type, payload, concurrencyKey } = prepareJob(request.body.type, request.body.payload);

    // Every run of a registered job is listed under its registered row.
    const registered = await this.jobsRepo.findRecurringByType(type);

    const job = await this.jobsRepo.enqueue({
      type,
      payload,
      concurrencyKey,
      recurringJobId: registered?.id ?? null,
      createdBy: request.user?.id ?? null,
    });
    if (!job) {
      throw new ConflictError("err_job_already_active");
    }

    return toJobSummary(job);
  }
}
