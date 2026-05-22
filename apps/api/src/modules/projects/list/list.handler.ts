import { FastifyRequest } from "fastify";
import { ListProjectsQuery, ListProjectsResponse } from "./list.schema";
import { injectable, inject } from "tsyringe";
import { PROJECTS_REPOSITORY } from "../projects.tokens";
import type { IProjectsRepository } from "../projects.repository.interface";

@injectable()
export class ListProjectsHandler {
  constructor(@inject(PROJECTS_REPOSITORY) private readonly projectsRepo: IProjectsRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListProjectsQuery }>): Promise<ListProjectsResponse> {
    const isAdmin = request.user?.role === "admin";
    const { status } = request.query;

    const filter = !isAdmin
      ? { status: "published" as const }
      : status
      ? { status }
      : undefined;

    const rows = await this.projectsRepo.list(filter);

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      content: row.content,
      status: row.status as "draft" | "published",
      featured: row.featured,
      sortOrder: row.sortOrder,
      githubUrl: row.githubUrl,
      liveUrl: row.liveUrl,
      coverImageUrl: row.coverImageUrl,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }
}
