import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PACKAGES_REPOSITORY } from "../../packages.tokens";
import type { IPackagesRepository } from "../../packages.repository.interface";
import { GetAdminPackageParams, GetAdminPackageResponse } from "./detail.schema";
import { NotFoundError } from "../../../../shared/http-errors";

@injectable()
export class GetAdminPackageHandler {
  constructor(@inject(PACKAGES_REPOSITORY) private readonly packagesRepo: IPackagesRepository) {}

  async handle(request: FastifyRequest<{ Params: GetAdminPackageParams }>): Promise<GetAdminPackageResponse> {
    const { id } = request.params;

    const row = await this.packagesRepo.findById(id);
    if (!row) {
      throw new NotFoundError("err_package_not_found");
    }

    return {
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
    };
  }
}
