import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PACKAGES_REPOSITORY } from "../../packages.tokens";
import type { IPackagesRepository } from "../../packages.repository.interface";
import { CreatePackageRequest, PackageResponse } from "./create.schema";
import { ConflictError } from "../../../../shared/http-errors";

@injectable()
export class CreatePackageHandler {
  constructor(@inject(PACKAGES_REPOSITORY) private readonly packagesRepo: IPackagesRepository) {}

  async handle(request: FastifyRequest<{ Body: CreatePackageRequest }>): Promise<PackageResponse> {
    const body = request.body;

    const existing = await this.packagesRepo.findBySlug(body.slug);
    if (existing) {
      throw new ConflictError("err_slug_already_exists");
    }

    const row = await this.packagesRepo.create({
      slug: body.slug,
      name: body.name,
      description: body.description ?? null,
      nugetUrl: body.nugetUrl ?? null,
      githubUrl: body.githubUrl ?? null,
      latestVersion: body.latestVersion ?? '1.0.0',
      isActive: body.isActive ?? true,
    });

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      nugetUrl: row.nugetUrl,
      githubUrl: row.githubUrl,
      latestVersion: row.latestVersion,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
