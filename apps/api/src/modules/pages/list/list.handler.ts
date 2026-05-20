import { FastifyRequest } from "fastify";
import { db, pages } from "@vefacaglar/db";
import { eq, and, desc } from "drizzle-orm";
import { ListPagesQuery, ListPagesResponse } from "./list.schema";
import { authenticateRequest } from "../../auth/auth.utils";

export class ListPagesHandler {
  async handle(request: FastifyRequest<{ Querystring: ListPagesQuery }>): Promise<ListPagesResponse> {
    let isAdmin = false;

    try {
      const { user } = await authenticateRequest(request);
      if (user.role === "admin") {
        isAdmin = true;
      }
    } catch {
      // Guest mode
    }

    const { status } = request.query;

    let conditions = [];

    if (!isAdmin) {
      conditions.push(eq(pages.status, "published"));
    } else if (status) {
      conditions.push(eq(pages.status, status));
    }

    const query = db
      .select()
      .from(pages)
      .orderBy(desc(pages.publishedAt), desc(pages.createdAt));

    const result = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    return result.map((page) => ({
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
    }));
  }
}
