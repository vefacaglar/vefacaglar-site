import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { JOBS_REPOSITORY, JOB_EVENTS_LISTENER } from "../../jobs.tokens";
import type { IJobsRepository } from "../../jobs.repository.interface";
import type { IJobEventsListener } from "../../job-events.listener.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { DEFAULT_JOB_STREAM_OPTIONS, JobStream, type JobStreamOptions } from "./job-stream";
import { resolveLogCursor } from "./stream.sse";
import { StreamJobParams, StreamJobQuery } from "./stream.schema";

/**
 * Opens a live SSE stream for one job. Everything that can fail with a normal
 * JSON error (404) happens here, BEFORE the route switches to streaming.
 *
 * Initial backlog: logs after the cursor (`Last-Event-ID` header, else
 * `?afterLogId`), or, without any cursor, the last `batchSize` (500) logs.
 */
@injectable()
export class StreamJobHandler {
  private options: JobStreamOptions = DEFAULT_JOB_STREAM_OPTIONS;

  constructor(
    @inject(JOBS_REPOSITORY) private readonly jobsRepo: IJobsRepository,
    @inject(JOB_EVENTS_LISTENER) private readonly listener: IJobEventsListener
  ) {}

  /** Test hook: shorter timers / smaller batches. */
  withOptions(options: Partial<JobStreamOptions>): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  async handle(request: FastifyRequest<{ Params: StreamJobParams; Querystring: StreamJobQuery }>): Promise<JobStream> {
    const { id } = request.params;
    const cursor = resolveLogCursor(request.headers["last-event-id"], request.query.afterLogId);

    const initial = await this.jobsRepo.findJobWithLogsAfter(id, cursor, this.options.batchSize);
    if (!initial) {
      throw new NotFoundError("err_job_not_found");
    }

    return new JobStream(this.jobsRepo, this.listener, id, cursor, initial, this.options, request.log);
  }
}
