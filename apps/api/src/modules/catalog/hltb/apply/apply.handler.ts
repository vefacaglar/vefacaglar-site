import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { HLTB_LOOKUP_SERVICE } from "../hltb.types";
import type { HltbLookupService } from "../hltb.service";
import type { HltbParams } from "../hltb.schema";
import type { HltbApplyBody } from "./apply.schema";
@injectable()
export class ApplyHltbHandler {
  constructor(@inject(HLTB_LOOKUP_SERVICE) private readonly service: HltbLookupService) {}
  handle(request: FastifyRequest<{ Params: HltbParams; Body: HltbApplyBody }>) {
    return this.service.apply(request.params.id, request.body);
  }
}
