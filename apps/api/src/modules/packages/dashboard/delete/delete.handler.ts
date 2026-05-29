import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PACKAGES_REPOSITORY } from "../../packages.tokens";
import type { IPackagesRepository } from "../../packages.repository.interface";
import { DeletePackageParams, DeletePackageResponse } from "./delete.schema";
import { NotFoundError } from "../../../../shared/http-errors";

@injectable()
export class DeletePackageHandler {
  constructor(@inject(PACKAGES_REPOSITORY) private readonly packagesRepo: IPackagesRepository) {}

  async handle(request: FastifyRequest<{ Params: DeletePackageParams }>): Promise<DeletePackageResponse> {
    const { id } = request.params;

    const row = await this.packagesRepo.findById(id);
    if (!row) {
      throw new NotFoundError("err_package_not_found");
    }

    await this.packagesRepo.delete(id);
    return { success: true };
  }
}
