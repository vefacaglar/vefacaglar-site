import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PROJECTS_REPOSITORY } from "../../projects.tokens";
import type { IProjectsRepository } from "../../projects.repository.interface";
import { ListAdminProjectsQuery, ListAdminProjectsResponse } from "./list.schema";

@injectable()
export class ListAdminProjectsHandler {
  constructor(@inject(PROJECTS_REPOSITORY) private readonly projectsRepo: IProjectsRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListAdminProjectsQuery }>): Promise<ListAdminProjectsResponse> {
    const { status } = request.query;
    const { items: rows } = await this.projectsRepo.listRaw(status ? { status } : undefined);

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
