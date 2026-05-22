import { FastifyRequest } from "fastify";
import { DeletePageParams, DeletePageResponse } from "./delete.schema";
import { injectable, inject } from "tsyringe";
import { PAGES_REPOSITORY } from "../pages.tokens";
import type { IPagesRepository } from "../pages.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";

@injectable()
export class DeletePageHandler {
  constructor(@inject(PAGES_REPOSITORY) private readonly pagesRepo: IPagesRepository) {}

  async handle(request: FastifyRequest<{ Params: DeletePageParams }>): Promise<DeletePageResponse> {
    const { id } = request.params;

    const existingPage = await this.pagesRepo.findById(id);

    if (!existingPage) {
      throw new NotFoundError("Page not found.");
    }

    await this.pagesRepo.delete(id);

    return { success: true };
  }
}
