import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PACKAGES_REPOSITORY } from "../packages.tokens";
import type { IPackagesRepository } from "../packages.repository.interface";
import { ListPackagesQuery, ListPackagesResponse } from "./list.schema";

@injectable()
export class ListPackagesHandler {
  constructor(@inject(PACKAGES_REPOSITORY) private readonly packagesRepo: IPackagesRepository) {}

  async handle(request: FastifyRequest<{ Querystring: ListPackagesQuery }>): Promise<ListPackagesResponse> {
    const { page, limit, q } = request.query;

    const pageNum = page !== undefined ? Number(page) : 1;
    const limitNum = limit !== undefined ? Number(limit) : 10;

    const { items: rows, total } = await this.packagesRepo.list({
      page: pageNum,
      limit: limitNum,
      q,
      isActive: true, // Only list active packages
    });

    const totalPages = Math.ceil(total / limitNum);

    const items = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      nugetUrl: null,
      npmUrl: null,
      githubUrl: row.githubUrl,
      docs: row.docs,
      latestVersion: row.latestVersion,
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
