import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { JOBS_REPOSITORY } from "../../jobs.tokens";
import type { IJobsRepository } from "../../jobs.repository.interface";
import { toJobSummary } from "../../jobs.mapper";
import { BadRequestError, NotFoundError } from "../../../../shared/http-errors";
import { CancelJobParams, CancelJobResponse } from "./cancel.schema";

/**
 * queued → cancelled immediately; running → `cancelRequested = true` (the
 * worker stops at its next batch boundary). Finished jobs cannot be cancelled.
 */
@injectable()
export class CancelJobHandler {
  constructor(@inject(JOBS_REPOSITORY) private readonly jobsRepo: IJobsRepository) {}

  async handle(request: FastifyRequest<{ Params: CancelJobParams }>): Promise<CancelJobResponse> {
    const { id } = request.params;

    const job = await this.jobsRepo.findById(id);
    if (!job) {
      throw new NotFoundError("err_job_not_found");
    }

    if (job.status === "queued") {
      const cancelled = await this.jobsRepo.cancelQueued(id);
      if (cancelled) return toJobSummary(cancelled);
      // Claimed by a worker in the meantime: fall through to a cancel request.
    }

    if (job.status === "queued" || job.status === "running") {
      const requested = await this.jobsRepo.requestCancel(id);
      if (requested) return toJobSummary(requested);
    }

    throw new BadRequestError("err_job_invalid_state");
  }
}
