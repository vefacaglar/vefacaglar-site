import { FastifyRequest } from "fastify";
import { UpdateProjectParams, UpdateProjectRequest, UpdateProjectResponse } from "./update.schema";
import { injectable, inject } from "tsyringe";
import { PROJECTS_REPOSITORY } from "../projects.tokens";
import type { IProjectsRepository } from "../projects.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";

@injectable()
export class UpdateProjectHandler {
  constructor(@inject(PROJECTS_REPOSITORY) private readonly projectsRepo: IProjectsRepository) {}

  async handle(
    request: FastifyRequest<{ Params: UpdateProjectParams; Body: UpdateProjectRequest }>
  ): Promise<UpdateProjectResponse> {
    const { id } = request.params;
    const {
      title, slug, summary, content, status, featured, sortOrder,
      githubUrl, liveUrl, coverImageUrl, seoTitle, seoDescription,
      startedAt, endedAt,
    } = request.body;

    const existingProject = await this.projectsRepo.findById(id);

    if (!existingProject) {
      throw new NotFoundError("err_project_not_found");
    }

    let publishedAt = existingProject.publishedAt;
    if (status === "published" && !existingProject.publishedAt) {
      publishedAt = new Date();
    } else if (status === "draft") {
      publishedAt = null;
    }

    const updatedProject = await this.projectsRepo.update(id, {
      title,
      slug,
      summary,
      content,
      status,
      featured: featured ?? existingProject.featured,
      sortOrder: sortOrder ?? existingProject.sortOrder,
      githubUrl: githubUrl || null,
      liveUrl: liveUrl || null,
      coverImageUrl: coverImageUrl || null,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      startedAt: startedAt || null,
      endedAt: endedAt || null,
      publishedAt,
      updatedAt: new Date(),
    });

    return {
      id: updatedProject.id,
      slug: updatedProject.slug,
      title: updatedProject.title,
      summary: updatedProject.summary,
      content: updatedProject.content,
      status: updatedProject.status as "draft" | "published",
      featured: updatedProject.featured,
      sortOrder: updatedProject.sortOrder,
      githubUrl: updatedProject.githubUrl,
      liveUrl: updatedProject.liveUrl,
      coverImageUrl: updatedProject.coverImageUrl,
      seoTitle: updatedProject.seoTitle,
      seoDescription: updatedProject.seoDescription,
      startedAt: updatedProject.startedAt,
      endedAt: updatedProject.endedAt,
      publishedAt: updatedProject.publishedAt ? updatedProject.publishedAt.toISOString() : null,
      createdAt: updatedProject.createdAt.toISOString(),
      updatedAt: updatedProject.updatedAt.toISOString(),
    };
  }
}
