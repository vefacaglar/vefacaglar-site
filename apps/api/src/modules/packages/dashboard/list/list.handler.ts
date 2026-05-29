import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PACKAGES_REPOSITORY } from "../../packages.tokens";
import type { IPackagesRepository } from "../../packages.repository.interface";
import { ListAdminPackagesQuery, ListAdminPackagesResponse } from "./list.schema";

@injectable()
export class ListAdminPackagesHandler {
  constructor(@inject(PACKAGES_REPOSITORY) private readonly packagesRepo: IPackagesRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListAdminPackagesQuery }>): Promise<ListAdminPackagesResponse> {
    const { page, limit, q } = request.query;

    const pageNum = page !== undefined ? Number(page) : 1;
    const limitNum = limit !== undefined ? Number(limit) : 10;

    const { items: rows, total } = await this.packagesRepo.list({
      page: pageNum,
      limit: limitNum,
      q,
    });

    const totalPages = Math.ceil(total / limitNum);

    const items = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      nugetUrl: row.nugetUrl,
      githubUrl: row.githubUrl,
      docs: row.docs,
      latestVersion: row.latestVersion,
      isActive: row.isActive,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    };
  }
}
