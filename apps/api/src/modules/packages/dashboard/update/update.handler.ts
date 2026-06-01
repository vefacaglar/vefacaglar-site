import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PACKAGES_REPOSITORY } from "../../packages.tokens";
import type { IPackagesRepository } from "../../packages.repository.interface";
import { UpdatePackageParams, UpdatePackageRequest, UpdatePackageResponse } from "./update.schema";
import { NotFoundError, ConflictError } from "../../../../shared/http-errors";

@injectable()
export class UpdatePackageHandler {
  constructor(@inject(PACKAGES_REPOSITORY) private readonly packagesRepo: IPackagesRepository) {}

  async handle(request: FastifyRequest<{ Params: UpdatePackageParams; Body: UpdatePackageRequest }>): Promise<UpdatePackageResponse> {
    const { id } = request.params;
    const body = request.body;

    const row = await this.packagesRepo.findById(id);
    if (!row) {
      throw new NotFoundError("err_package_not_found");
    }

    if (body.slug !== row.slug) {
      const existing = await this.packagesRepo.findBySlug(body.slug);
      if (existing && existing.id !== id) {
        throw new ConflictError("err_slug_already_exists");
      }
    }

    const updated = await this.packagesRepo.update(id, {
      slug: body.slug,
      name: body.name,
      description: body.description,
      githubUrl: body.githubUrl,
      docs: body.docs,
      latestVersion: body.latestVersion,
      isActive: body.isActive,
      content: body.content,
      updatedAt: new Date(),
    });

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      nugetUrl: null,
      npmUrl: null,
      githubUrl: updated.githubUrl,
      docs: updated.docs,
      latestVersion: updated.latestVersion,
      isActive: updated.isActive,
      content: updated.content,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
