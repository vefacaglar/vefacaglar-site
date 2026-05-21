import { FastifyRequest } from "fastify";
import { DeletePageParams, DeletePageResponse } from "./delete.schema";
import { PagesRepository } from "../pages.repository";

export class DeletePageHandler {
  constructor(private readonly pagesRepo: PagesRepository) {}

  async handle(request: FastifyRequest<{ Params: DeletePageParams }>): Promise<DeletePageResponse> {
    const { id } = request.params;

    const existingPage = await this.pagesRepo.findById(id);

    if (!existingPage) {
      throw new Error("PageNotFound");
    }

    await this.pagesRepo.delete(id);

    return { success: true };
  }
}
