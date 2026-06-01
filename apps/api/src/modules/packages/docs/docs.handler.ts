import { FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { PACKAGES_REPOSITORY } from "../packages.tokens";
import type { IPackagesRepository } from "../packages.repository.interface";
import { GetDocParams, GetDocResponse } from "./docs.schema";
import { NotFoundError } from "../../../shared/http-errors";

@injectable()
export class GetDocHandler {
  constructor(@inject(PACKAGES_REPOSITORY) private readonly packagesRepo: IPackagesRepository) {}

  async handle(request: FastifyRequest<{ Params: GetDocParams }>): Promise<GetDocResponse> {
    const { slug, docSlug } = request.params;

    const pkg = await this.packagesRepo.findBySlug(slug);
    if (!pkg || !pkg.isActive) {
      throw new NotFoundError("err_package_not_found");
    }

    const doc = await this.packagesRepo.findDocBySlug(pkg.id, docSlug);
    if (!doc || !doc.isPublished) {
      throw new NotFoundError("err_doc_not_found");
    }

    const [categories, docs] = await Promise.all([
      this.packagesRepo.listCategories(pkg.id),
      this.packagesRepo.listDocs(pkg.id),
    ]);

    const publishedDocs = docs.filter((d) => d.isPublished);

    return {
      id: doc.id,
      groupId: doc.groupId,
      categoryId: doc.categoryId,
      slug: doc.slug,
      title: doc.title,
      description: doc.description,
      filePath: doc.filePath,
      content: doc.content,
      displayOrder: doc.displayOrder,
      categories: categories.map((cat) => ({
        id: cat.id,
        title: cat.title,
        slug: cat.slug,
        displayOrder: cat.displayOrder,
      })),
      docsList: publishedDocs.map((d) => ({
        id: d.id,
        categoryId: d.categoryId,
        slug: d.slug,
        title: d.title,
        description: d.description,
        displayOrder: d.displayOrder,
      })),
    };
  }
}
