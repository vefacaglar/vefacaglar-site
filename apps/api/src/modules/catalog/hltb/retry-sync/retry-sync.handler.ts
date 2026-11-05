import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { HLTB_LOOKUP_SERVICE } from "../hltb.types";
import type { HltbLookupService } from "../hltb.service";
import type { HltbParams } from "../hltb.schema";
@injectable()
export class RetryHltbSyncHandler {
  constructor(@inject(HLTB_LOOKUP_SERVICE) private readonly service: HltbLookupService) {}
  handle(request: FastifyRequest<{ Params: HltbParams }>) { return this.service.retrySync(request.params.id); }
}
