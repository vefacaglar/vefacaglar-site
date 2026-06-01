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
      githubUrl: body.githubUrl ?? null,
      docs: body.docs ?? null,
      latestVersion: body.latestVersion ?? '1.0.0',
      isActive: body.isActive ?? true,
      content: body.content ?? "",
    });

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      nugetUrl: null,
      npmUrl: null,
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
