import { FastifyRequest } from "fastify";
import { db, posts } from "@vefacaglar/db";
import { eq } from "drizzle-orm";
import { DeletePostParams, DeletePostResponse } from "./delete.schema";
import { authenticateRequest } from "../../auth/auth.utils";

export class DeletePostHandler {
  async handle(request: FastifyRequest<{ Params: DeletePostParams }>): Promise<DeletePostResponse> {
    const { user } = await authenticateRequest(request);

    if (user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const { id } = request.params;

    const [existingPost] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);

    if (!existingPost) {
      throw new Error("PostNotFound");
    }

    await db.delete(posts).where(eq(posts.id, id));

    return {
      success: true,
    };
  }
}
