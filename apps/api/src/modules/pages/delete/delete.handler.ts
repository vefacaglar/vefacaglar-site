import { FastifyRequest } from "fastify";
import { db, pages } from "@vefacaglar/db";
import { eq } from "drizzle-orm";
import { DeletePageParams, DeletePageResponse } from "./delete.schema";
import { authenticateRequest } from "../../auth/auth.utils";

export class DeletePageHandler {
  async handle(request: FastifyRequest<{ Params: DeletePageParams }>): Promise<DeletePageResponse> {
    const { user } = await authenticateRequest(request);

    if (user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const { id } = request.params;

    const [existingPage] = await db
      .select()
      .from(pages)
      .where(eq(pages.id, id))
      .limit(1);

    if (!existingPage) {
      throw new Error("PageNotFound");
    }

    await db.delete(pages).where(eq(pages.id, id));

    return {
      success: true,
    };
  }
}
