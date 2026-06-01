import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PACKAGES_REPOSITORY } from "../packages.tokens";
import type { IPackagesRepository } from "../packages.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";
import { GetPackageItemParams, GetPackageItemResponse } from "./package-detail.schema";

@injectable()
export class GetPackageItemHandler {
  constructor(@inject(PACKAGES_REPOSITORY) private readonly packagesRepo: IPackagesRepository) {}

  async handle(request: FastifyRequest<{ Params: GetPackageItemParams }>): Promise<GetPackageItemResponse> {
    const { groupSlug, packageSlug } = request.params;

    const group = await this.packagesRepo.findBySlug(groupSlug);
    if (!group || !group.isActive) {
      throw new NotFoundError("err_package_not_found");
    }

    const item = await this.packagesRepo.findPackageItemByGroupAndSlug(group.id, packageSlug);
    if (!item || !item.isActive) {
      throw new NotFoundError("err_package_not_found");
    }

    return {
      id: item.id,
      groupId: item.groupId,
      groupSlug: group.slug,
      groupName: group.name,
      slug: item.slug,
      name: item.name,
      description: item.description,
      nugetUrl: item.nugetUrl,
      npmUrl: item.npmUrl,
      githubUrl: item.githubUrl,
      latestVersion: item.latestVersion,
      content: item.content,
    };
  }
}
