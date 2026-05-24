import { FastifyRequest } from "fastify";
import { GetAuthorParams, GetAuthorResponse } from "./detail.schema";
import { injectable } from "tsyringe";
import { AuthorsService } from "../authors.service";

@injectable()
export class GetAuthorHandler {
  constructor(private readonly authorsService: AuthorsService) {}

  async handle(request: FastifyRequest<{ Params: GetAuthorParams }>): Promise<GetAuthorResponse> {
    return this.authorsService.getByUsername(request.params.username);
  }
}
