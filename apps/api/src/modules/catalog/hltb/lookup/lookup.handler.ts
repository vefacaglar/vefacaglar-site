import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { HLTB_LOOKUP_SERVICE } from "../hltb.types";
import type { HltbLookupService } from "../hltb.service";
import type { HltbParams } from "../hltb.schema";
import type { HltbLookupBody } from "./lookup.schema";
@injectable()
export class LookupHltbHandler {
  constructor(@inject(HLTB_LOOKUP_SERVICE) private readonly service: HltbLookupService) {}
  handle(request: FastifyRequest<{ Params: HltbParams; Body: HltbLookupBody }>) {
    return this.service.lookup(request.params.id, request.body);
  }
}
