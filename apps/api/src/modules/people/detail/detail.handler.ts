import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { NotFoundError } from "../../../shared/http-errors";
import { PEOPLE_REPOSITORY, type IPeopleRepository } from "../people.repository.interface";
import type { PersonParams, PersonQuery, PersonPage } from "./detail.schema";
@injectable()
export class GetPersonHandler {
  constructor(@inject(PEOPLE_REPOSITORY) private readonly repo: IPeopleRepository) {}
  async handle(request: FastifyRequest<{ Params: PersonParams; Querystring: PersonQuery }>): Promise<PersonPage> {
    const page = request.query.page ?? 1, limit = request.query.limit ?? 24;
    const result = await this.repo.findPublic(request.params.id, page, limit);
    if (!result) throw new NotFoundError("err_page_not_found");
    return { ...result, page, limit, totalPages: Math.ceil(result.total / limit) };
  }
}
