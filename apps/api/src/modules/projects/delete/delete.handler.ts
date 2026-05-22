import { FastifyRequest } from "fastify";
import { DeleteProjectParams, DeleteProjectResponse } from "./delete.schema";
import { injectable, inject } from "tsyringe";
import { PROJECTS_REPOSITORY } from "../projects.tokens";
import type { IProjectsRepository } from "../projects.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";

@injectable()
export class DeleteProjectHandler {
  constructor(@inject(PROJECTS_REPOSITORY) private readonly projectsRepo: IProjectsRepository) {}

  async handle(request: FastifyRequest<{ Params: DeleteProjectParams }>): Promise<DeleteProjectResponse> {
    const { id } = request.params;

    const existingProject = await this.projectsRepo.findById(id);

    if (!existingProject) {
      throw new NotFoundError("err_project_not_found");
    }

    await this.projectsRepo.delete(id);

    return { success: true };
  }
}
