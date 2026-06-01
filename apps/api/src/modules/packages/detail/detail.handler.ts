import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PACKAGES_REPOSITORY } from "../packages.tokens";
import type { IPackagesRepository } from "../packages.repository.interface";
import { GetPackageParams, GetPackageResponse } from "./detail.schema";
import { NotFoundError } from "../../../shared/http-errors";

@injectable()
export class GetPackageHandler {
  constructor(@inject(PACKAGES_REPOSITORY) private readonly packagesRepo: IPackagesRepository) {}

  async handle(request: FastifyRequest<{ Params: GetPackageParams }>): Promise<GetPackageResponse> {
    const { slug } = request.params;

    const pkg = await this.packagesRepo.findBySlug(slug);
    if (!pkg || !pkg.isActive) {
      throw new NotFoundError("err_package_not_found");
    }

    const [packageItems, categories, docs] = await Promise.all([
      this.packagesRepo.listPackageItems(pkg.id),
      this.packagesRepo.listCategories(pkg.id),
      this.packagesRepo.listDocs(pkg.id),
    ]);

    const publishedDocs = docs.filter((doc) => doc.isPublished);

    return {
      id: pkg.id,
      slug: pkg.slug,
      name: pkg.name,
      description: pkg.description,
      nugetUrl: null,
      npmUrl: null,
      githubUrl: pkg.githubUrl,
      docs: pkg.docs,
      latestVersion: pkg.latestVersion,
      content: pkg.content,
      packages: packageItems
        .filter((item) => item.isActive)
        .map((item) => ({
          id: item.id,
          groupId: item.groupId,
          slug: item.slug,
          name: item.name,
          description: item.description,
          nugetUrl: item.nugetUrl,
          npmUrl: item.npmUrl,
          githubUrl: item.githubUrl,
          latestVersion: item.latestVersion,
          isActive: item.isActive,
        })),
      categories: categories.map((cat) => ({
        id: cat.id,
        title: cat.title,
        slug: cat.slug,
        displayOrder: cat.displayOrder,
      })),
      docsList: publishedDocs.map((doc) => ({
        id: doc.id,
        categoryId: doc.categoryId,
        slug: doc.slug,
        title: doc.title,
        description: doc.description,
        displayOrder: doc.displayOrder,
      })),
    };
  }
}
