import { FastifyRequest } from "fastify";
import { DeletePostParams, DeletePostResponse } from "./delete.schema";
import { AuthService } from "../../auth/auth.service";
import { PostsRepository } from "../posts.repository";

export class DeletePostHandler {
  constructor(
    private readonly postsRepo: PostsRepository,
    private readonly auth: AuthService
  ) {}

  async handle(request: FastifyRequest<{ Params: DeletePostParams }>): Promise<DeletePostResponse> {
    const { user } = await this.auth.authenticate(request);

    if (user.role !== "admin") {
      throw new Error("Unauthorized");
    }

    const { id } = request.params;

    const existingPost = await this.postsRepo.findById(id);

    if (!existingPost) {
      throw new Error("PostNotFound");
    }

    await this.postsRepo.delete(id);

    return {
      success: true,
    };
  }
}
