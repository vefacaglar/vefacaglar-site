import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { JOBS_REPOSITORY, JOB_STREAM_TOKEN_SERVICE } from "../../jobs.tokens";
import type { IJobsRepository } from "../../jobs.repository.interface";
import type { IJobStreamTokenService } from "../../job-stream-token.service.interface";
import { NotFoundError, UnauthorizedError } from "../../../../shared/http-errors";
import { CreateStreamTokenParams, CreateStreamTokenResponse } from "./stream-token.schema";

/** Mount point of the jobs module (see app.ts). */
const JOBS_ROUTE_PREFIX = "/api/jobs";

/**
 * Issues a short-lived token bound to one job and the calling admin, so the
 * browser can open `GET .../stream?token=` directly against the API.
 */
@injectable()
export class CreateStreamTokenHandler {
  constructor(
    @inject(JOBS_REPOSITORY) private readonly jobsRepo: IJobsRepository,
    @inject(JOB_STREAM_TOKEN_SERVICE) private readonly tokens: IJobStreamTokenService
  ) {}

  async handle(request: FastifyRequest<{ Params: CreateStreamTokenParams }>): Promise<CreateStreamTokenResponse> {
    const { id } = request.params;
    const userId = request.user?.id;
    if (!userId) {
      // The route guard (requireAdmin) always sets the user; defensive only.
      throw new UnauthorizedError("err_unauthorized");
    }

    const job = await this.jobsRepo.findById(id);
    if (!job) {
      throw new NotFoundError("err_job_not_found");
    }

    const { token, expiresAt } = await this.tokens.sign(userId, job.id);
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      streamPath: `${JOBS_ROUTE_PREFIX}/dashboard/${job.id}/stream`,
    };
  }
}
