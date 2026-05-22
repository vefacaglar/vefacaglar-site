import { FastifyRequest } from "fastify";
import { DeletePostParams, DeletePostResponse } from "./delete.schema";
import { injectable, inject } from "tsyringe";
import { POSTS_REPOSITORY } from "../../posts.tokens";
import type { IPostsRepository } from "../../posts.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";

@injectable()
export class DeletePostHandler {
  constructor(@inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository) {}

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
