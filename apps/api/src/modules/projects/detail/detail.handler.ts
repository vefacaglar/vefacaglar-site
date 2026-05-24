import { FastifyRequest } from "fastify";
import { GetProjectParams, GetProjectResponse } from "./detail.schema";
import { injectable, inject } from "tsyringe";
import { PROJECTS_REPOSITORY } from "../projects.tokens";
import type { IProjectsRepository } from "../projects.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";

@injectable()
export class GetProjectHandler {
  constructor(@inject(PROJECTS_REPOSITORY) private readonly projectsRepo: IProjectsRepository) {}

  async handle(request: FastifyRequest<{ Params: GetProjectParams }>): Promise<GetProjectResponse> {
    const { slug } = request.params;

    const project = await this.projectsRepo.findBySlug(slug);

    if (!project || project.status !== "published") {
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
