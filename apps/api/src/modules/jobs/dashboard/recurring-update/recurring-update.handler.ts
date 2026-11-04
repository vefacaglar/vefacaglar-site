import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { JOBS_REPOSITORY } from "../../jobs.tokens";
import type { IJobsRepository } from "../../jobs.repository.interface";
import { toRecurringJob } from "../../jobs.mapper";
import { normalizeCron } from "../../cron";
import { BadRequestError, NotFoundError } from "../../../../shared/http-errors";
import {
  UpdateRecurringJobParams,
  UpdateRecurringJobRequest,
  UpdateRecurringJobResponse,
} from "./recurring-update.schema";

@injectable()
export class UpdateRecurringJobHandler {
  constructor(@inject(JOBS_REPOSITORY) private readonly jobsRepo: IJobsRepository) {}

  async handle(
    request: FastifyRequest<{ Params: UpdateRecurringJobParams; Body: UpdateRecurringJobRequest }>
  ): Promise<UpdateRecurringJobResponse> {
    const { id } = request.params;
    const { enabled } = request.body;

    // undefined = unchanged, null = clear (manual only), string = validated expression.
    let cron: string | null | undefined;
    if (request.body.cron === null) {
      cron = null;
    } else if (request.body.cron !== undefined) {
      const normalized = normalizeCron(request.body.cron);
      if (!normalized) {
        throw new BadRequestError("err_job_invalid_cron");
      }
      cron = normalized;
    }

    const existing = await this.jobsRepo.findRecurringById(id);
    if (!existing) {
      throw new NotFoundError("err_recurring_job_not_found");
    }

    const updated = await this.jobsRepo.updateRecurring(id, {
      enabled,
      // An unchanged expression keeps the already computed `next_run_at`.
      cron: cron !== undefined && cron !== existing.cron ? cron : undefined,
    });
    if (!updated) {
      throw new NotFoundError("err_recurring_job_not_found");
    }
    return toRecurringJob(updated);
  }
}
