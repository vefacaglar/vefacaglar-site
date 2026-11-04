import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { JOBS_REPOSITORY } from "../../jobs.tokens";
import type { IJobsRepository } from "../../jobs.repository.interface";
import { toJobLog, toJobSummary } from "../../jobs.mapper";
import { NotFoundError } from "../../../../shared/http-errors";
import { GetJobParams, GetJobQuery, GetJobResponse } from "./detail.schema";

export const MAX_LOGS_PER_REQUEST = 200;

@injectable()
export class GetJobHandler {
  constructor(@inject(JOBS_REPOSITORY) private readonly jobsRepo: IJobsRepository) {}

  async handle(request: FastifyRequest<{ Params: GetJobParams; Querystring: GetJobQuery }>): Promise<GetJobResponse> {
    const { id } = request.params;
    const afterLogId = request.query.afterLogId !== undefined ? Number(request.query.afterLogId) : 0;

    const job = await this.jobsRepo.findById(id);
    if (!job) {
      throw new NotFoundError("err_job_not_found");
    }

    const logs = await this.jobsRepo.listLogs(id, afterLogId, MAX_LOGS_PER_REQUEST);
    return { job: toJobSummary(job), logs: logs.map(toJobLog) };
  }
}
