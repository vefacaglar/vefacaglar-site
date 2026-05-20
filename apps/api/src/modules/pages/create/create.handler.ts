import { FastifyRequest } from "fastify";
import { db, pages } from "@vefacaglar/db";
import { CreatePageRequest, PageResponse } from "./create.schema";
import { authenticateRequest } from "../../auth/auth.utils";

export class CreatePageHandler {
  async handle(request: FastifyRequest<{ Body: CreatePageRequest }>): Promise<PageResponse> {
    const { user } = await authenticateRequest(request);

    if (user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const { title, slug, content, status, seoTitle, seoDescription } = request.body;

    const publishedAt = status === "published" ? new Date() : null;

    const [newPage] = await db
      .insert(pages)
      .values({
        title,
        slug,
        content,
        status,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        publishedAt,
      })
      .returning();

    return {
      id: newPage.id,
      slug: newPage.slug,
      title: newPage.title,
      content: newPage.content,
      status: newPage.status as "draft" | "published",
      seoTitle: newPage.seoTitle,
      seoDescription: newPage.seoDescription,
      publishedAt: newPage.publishedAt ? newPage.publishedAt.toISOString() : null,
      createdAt: newPage.createdAt.toISOString(),
      updatedAt: newPage.updatedAt.toISOString(),
    };
  }
}
