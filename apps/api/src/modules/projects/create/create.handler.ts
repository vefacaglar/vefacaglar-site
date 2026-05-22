import { FastifyRequest } from "fastify";
import { CreateProjectRequest, ProjectResponse } from "./create.schema";
import { injectable, inject } from "tsyringe";
import { PROJECTS_REPOSITORY } from "../projects.tokens";
import type { IProjectsRepository } from "../projects.repository.interface";

@injectable()
export class CreateProjectHandler {
  constructor(@inject(PROJECTS_REPOSITORY) private readonly projectsRepo: IProjectsRepository) {}

  async handle(request: FastifyRequest<{ Body: CreateProjectRequest }>): Promise<ProjectResponse> {
    const {
      title, slug, summary, content, status, featured, sortOrder,
      githubUrl, liveUrl, coverImageUrl, seoTitle, seoDescription,
      startedAt, endedAt,
    } = request.body;

    const publishedAt = status === "published" ? new Date() : null;

    const newProject = await this.projectsRepo.create({
      title,
      slug,
      summary,
      content,
      status,
      featured: featured ?? false,
      sortOrder: sortOrder ?? 0,
      githubUrl: githubUrl || null,
      liveUrl: liveUrl || null,
      coverImageUrl: coverImageUrl || null,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      startedAt: startedAt || null,
      endedAt: endedAt || null,
      publishedAt,
    });

    return {
      id: newProject.id,
      slug: newProject.slug,
      title: newProject.title,
      summary: newProject.summary,
      content: newProject.content,
      status: newProject.status as "draft" | "published",
      featured: newProject.featured,
      sortOrder: newProject.sortOrder,
      githubUrl: newProject.githubUrl,
      liveUrl: newProject.liveUrl,
      coverImageUrl: newProject.coverImageUrl,
      seoTitle: newProject.seoTitle,
      seoDescription: newProject.seoDescription,
      startedAt: newProject.startedAt,
      endedAt: newProject.endedAt,
      publishedAt: newProject.publishedAt ? newProject.publishedAt.toISOString() : null,
      createdAt: newProject.createdAt.toISOString(),
      updatedAt: newProject.updatedAt.toISOString(),
    };
  }
}
