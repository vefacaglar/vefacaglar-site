import { FastifyRequest } from "fastify";
import { DeletePostParams, DeletePostResponse } from "./delete.schema";
import { injectable, inject } from "tsyringe";
import { POSTS_REPOSITORY } from "../../posts.tokens";
import type { IPostsRepository } from "../../posts.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { EVENT_BUS } from "../../../../shared/events/events.tokens";
import type { IEventBus } from "../../../../shared/events/event-bus";
import { postRemoved } from "../../posts.events";

@injectable()
export class DeletePostHandler {
  constructor(
    @inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus
  ) {}

  async handle(request: FastifyRequest<{ Params: DeletePostParams }>): Promise<DeletePostResponse> {
    const { id } = request.params;

    const existingPost = await this.postsRepo.findById(id);

    if (!existingPost) {
      throw new NotFoundError("Post not found.");
    }

    await this.postsRepo.delete(id);

    try {
      await this.eventBus.publish(postRemoved(id));
    } catch {
      // best-effort
    }

    return { success: true };
  }
}
