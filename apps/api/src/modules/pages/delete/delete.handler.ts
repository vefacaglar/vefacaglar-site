import { FastifyRequest } from "fastify";
import { DeletePageParams, DeletePageResponse } from "./delete.schema";
import { AuthService } from "../../auth/auth.service";
import { PagesRepository } from "../pages.repository";

export class DeletePageHandler {
  constructor(
    private readonly pagesRepo: PagesRepository,
    private readonly auth: AuthService
  ) {}

  async handle(request: FastifyRequest<{ Params: DeletePageParams }>): Promise<DeletePageResponse> {
    const { user } = await this.auth.authenticate(request);

    if (user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const { id } = request.params;

    const existingPage = await this.pagesRepo.findById(id);

    if (!existingPage) {
      throw new Error("PageNotFound");
    }

    await this.pagesRepo.delete(id);

    return {
      success: true,
    };
  }
}
