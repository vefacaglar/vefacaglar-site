import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { JOBS_REPOSITORY } from "../../jobs.tokens";
import type { IJobsRepository } from "../../jobs.repository.interface";
import { toJobSummary } from "../../jobs.mapper";
import { ListJobsQuery, ListJobsResponse } from "./list.schema";

const DEFAULT_LIMIT = 20;

@injectable()
export class ListJobsHandler {
  constructor(@inject(JOBS_REPOSITORY) private readonly jobsRepo: IJobsRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListJobsQuery }>): Promise<ListJobsResponse> {
    const { status, type, recurringJobId, page, limit } = request.query;
    const pageNum = page !== undefined ? Number(page) : 1;
    const limitNum = limit !== undefined ? Number(limit) : DEFAULT_LIMIT;

    const { items, total } = await this.jobsRepo.list({
      status: status || undefined,
      type: type || undefined,
      recurringJobId: recurringJobId || undefined,
      page: pageNum,
      limit: limitNum,
    });

    return { items: items.map(toJobSummary), total, page: pageNum, limit: limitNum };
  }
}
