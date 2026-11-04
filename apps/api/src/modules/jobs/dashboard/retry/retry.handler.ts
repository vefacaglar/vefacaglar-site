import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { JOBS_REPOSITORY } from "../../jobs.tokens";
import type { IJobsRepository } from "../../jobs.repository.interface";
import { toJobSummary } from "../../jobs.mapper";
import { BadRequestError, ConflictError, NotFoundError } from "../../../../shared/http-errors";
import { RetryJobParams, RetryJobResponse } from "./retry.schema";

/** failed/cancelled → queued with attempts reset; the checkpoint is kept so the job resumes. */
@injectable()
export class RetryJobHandler {
  constructor(@inject(JOBS_REPOSITORY) private readonly jobsRepo: IJobsRepository) {}

  async handle(request: FastifyRequest<{ Params: RetryJobParams }>): Promise<RetryJobResponse> {
    const { id } = request.params;

    const job = await this.jobsRepo.findById(id);
    if (!job) {
      throw new NotFoundError("err_job_not_found");
    }
    if (job.status !== "failed" && job.status !== "cancelled") {
      throw new BadRequestError("err_job_invalid_state");
    }

    if (job.concurrencyKey) {
      const active = await this.jobsRepo.findActiveByConcurrencyKey(job.concurrencyKey);
      if (active) {
        throw new ConflictError("err_job_already_active");
      }
    }

    const requeued = await this.jobsRepo.requeue(id);
    if (!requeued) {
      throw new BadRequestError("err_job_invalid_state");
    }
    return toJobSummary(requeued);
  }
}
