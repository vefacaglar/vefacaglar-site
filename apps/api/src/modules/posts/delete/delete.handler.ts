import { FastifyRequest } from "fastify";
import { DeletePostParams, DeletePostResponse } from "./delete.schema";
import { PostsRepository } from "../posts.repository";
import { NotFoundError } from "../../../shared/http-errors";

export class DeletePostHandler {
  constructor(private readonly postsRepo: PostsRepository) {}

  async handle(request: FastifyRequest<{ Params: DeletePostParams }>): Promise<DeletePostResponse> {
    const { id } = request.params;

    const existingPost = await this.postsRepo.findById(id);

    if (!existingPost) {
      throw new NotFoundError("Post not found.");
    }

    await this.postsRepo.delete(id);

    return { success: true };
  }
}
