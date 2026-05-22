import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { NotFoundError } from "../../../../shared/http-errors";
import { PROJECTS_REPOSITORY } from "../../projects.tokens";
import type { IProjectsRepository } from "../../projects.repository.interface";
import { GetAdminProjectParams, GetAdminProjectResponse } from "./detail.schema";

@injectable()
export class GetAdminProjectHandler {
  constructor(@inject(PROJECTS_REPOSITORY) private readonly projectsRepo: IProjectsRepository) {}

  async handle(request: FastifyRequest<{ Params: GetAdminProjectParams }>): Promise<GetAdminProjectResponse> {
    const project = await this.projectsRepo.findById(request.params.id);

    if (!project) {
      throw new NotFoundError("err_project_not_found");
    }

    return {
      id: project.id,
      slug: project.slug,
      title: project.title,
      summary: project.summary,
      content: project.content,
      status: project.status as "draft" | "published",
      featured: project.featured,
      sortOrder: project.sortOrder,
      githubUrl: project.githubUrl,
      liveUrl: project.liveUrl,
      coverImageUrl: project.coverImageUrl,
      seoTitle: project.seoTitle,
      seoDescription: project.seoDescription,
      startedAt: project.startedAt,
      endedAt: project.endedAt,
      publishedAt: project.publishedAt ? project.publishedAt.toISOString() : null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
