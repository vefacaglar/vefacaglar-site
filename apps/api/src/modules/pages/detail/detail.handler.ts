import { FastifyRequest } from "fastify";
import { GetPageParams, GetPageResponse } from "./detail.schema";
import { AuthService } from "../../auth/auth.service";
import { PagesRepository } from "../pages.repository";

export class GetPageHandler {
  constructor(
    private readonly pagesRepo: PagesRepository,
    private readonly auth: AuthService
  ) {}

  async handle(request: FastifyRequest<{ Params: GetPageParams }>): Promise<GetPageResponse> {
    const { slug } = request.params;

    const page = await this.pagesRepo.findBySlug(slug);

    if (!page) {
      throw new Error("PageNotFound");
    }

    if (page.status === "draft") {
      let isAdmin = false;
      try {
        const { user } = await this.auth.authenticate(request);
        if (user.role === "admin") {
          isAdmin = true;
        }
      } catch {
        // Not authenticated
      }

      if (!isAdmin) {
        throw new Error("PageNotFound");
      }
    }

    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      status: page.status as "draft" | "published",
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
      publishedAt: page.publishedAt ? page.publishedAt.toISOString() : null,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    };
  }
}
