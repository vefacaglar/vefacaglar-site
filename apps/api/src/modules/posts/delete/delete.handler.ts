import { FastifyRequest } from "fastify";
import { DeletePostParams, DeletePostResponse } from "./delete.schema";
import { PostsRepository } from "../posts.repository";

export class DeletePostHandler {
  constructor(private readonly postsRepo: PostsRepository) {}

  async handle(request: FastifyRequest<{ Params: DeletePostParams }>): Promise<DeletePostResponse> {
    const { id } = request.params;

    const existingPost = await this.postsRepo.findById(id);

    if (!existingPost) {
      throw new Error("PostNotFound");
    }

    await this.postsRepo.delete(id);

    return { success: true };
  }
}
