import { FastifyRequest } from "fastify";
import { db, pages } from "@vefacaglar/db";
import { eq } from "drizzle-orm";
import { UpdatePageParams, UpdatePageRequest, UpdatePageResponse } from "./update.schema";
import { authenticateRequest } from "../../auth/auth.utils";

export class UpdatePageHandler {
  async handle(
    request: FastifyRequest<{ Params: UpdatePageParams; Body: UpdatePageRequest }>
  ): Promise<UpdatePageResponse> {
    const { user } = await authenticateRequest(request);

    if (user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const { id } = request.params;
    const { title, slug, content, status, seoTitle, seoDescription } = request.body;

    const [existingPage] = await db
      .select()
      .from(pages)
      .where(eq(pages.id, id))
      .limit(1);

    if (!existingPage) {
      throw new Error("PageNotFound");
    }

    let publishedAt = existingPage.publishedAt;
    if (status === "published" && !existingPage.publishedAt) {
      publishedAt = new Date();
    } else if (status === "draft") {
      publishedAt = null;
    }

    const [updatedPage] = await db
      .update(pages)
      .set({
        title,
        slug,
        content,
        status,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, id))
      .returning();

    return {
      id: updatedPage.id,
      slug: updatedPage.slug,
      title: updatedPage.title,
      content: updatedPage.content,
      status: updatedPage.status as "draft" | "published",
      seoTitle: updatedPage.seoTitle,
      seoDescription: updatedPage.seoDescription,
      publishedAt: updatedPage.publishedAt ? updatedPage.publishedAt.toISOString() : null,
      createdAt: updatedPage.createdAt.toISOString(),
      updatedAt: updatedPage.updatedAt.toISOString(),
    };
  }
}
