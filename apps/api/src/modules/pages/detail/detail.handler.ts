import { FastifyRequest } from "fastify";
import { db, pages } from "@vefacaglar/db";
import { eq } from "drizzle-orm";
import { GetPageParams, GetPageResponse } from "./detail.schema";
import { authenticateRequest } from "../../auth/auth.utils";

export class GetPageHandler {
  async handle(request: FastifyRequest<{ Params: GetPageParams }>): Promise<GetPageResponse> {
    const { slug } = request.params;

    const [page] = await db
      .select()
      .from(pages)
      .where(eq(pages.slug, slug))
      .limit(1);

    if (!page) {
      throw new Error("PageNotFound");
    }

    if (page.status === "draft") {
      let isAdmin = false;
      try {
        const { user } = await authenticateRequest(request);
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
