import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../shared/http-errors";
import { PEOPLE_REPOSITORY, type IPeopleRepository } from "../people.repository.interface";
import type { ResolvePersonParams, ResolvedPerson } from "./resolve.schema";
@injectable()
export class ResolvePersonHandler {
  constructor(@inject(PEOPLE_REPOSITORY) private readonly repo: IPeopleRepository) {}
  async handle(request: FastifyRequest<{ Params: ResolvePersonParams }>): Promise<ResolvedPerson> {
    const person = await this.repo.resolveWikidata(request.params.wikidataId);
    if (!person) throw new NotFoundError("err_page_not_found");
    return person;
  }
}
