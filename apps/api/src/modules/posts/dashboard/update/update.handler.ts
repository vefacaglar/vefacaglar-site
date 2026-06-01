import { FastifyRequest } from "fastify";
import { UpdatePostParams, UpdatePostRequest, UpdatePostResponse } from "./update.schema";
import { injectable, inject } from "tsyringe";
import { POSTS_REPOSITORY } from "../../posts.tokens";
import type { IPostsRepository } from "../../posts.repository.interface";
import { NotFoundError } from "../../../../shared/http-errors";
import { EVENT_BUS } from "../../../../shared/events/events.tokens";
import type { IEventBus } from "../../../../shared/events/event-bus";
import { postChanged } from "../../posts.events";

@injectable()
export class UpdatePostHandler {
  constructor(
    @inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus
  ) {}

  async handle(
    request: FastifyRequest<{ Params: UpdatePostParams; Body: UpdatePostRequest }>
  ): Promise<UpdatePostResponse> {
    const user = request.user!;

    const { id } = request.params;
    const { title, slug, excerpt, content, status, coverImageUrl, seoTitle, seoDescription } = request.body;

    const existingPost = await this.postsRepo.findById(id);

    if (!existingPost) {
      throw new NotFoundError("Post not found.");
    }

    let publishedAt = existingPost.publishedAt;
    if (status === "published" && !existingPost.publishedAt) {
      publishedAt = new Date();
    } else if (status === "draft") {
      publishedAt = null;
    }

    const updatedPost = await this.postsRepo.update(id, {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      status,
      coverImageUrl: coverImageUrl || null,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      publishedAt,
      updatedAt: new Date(),
    });

    try {
      await this.eventBus.publish(postChanged(id));
    } catch {
      // best-effort
    }

    return {
      id: updatedPost.id,
      slug: updatedPost.slug,
      title: updatedPost.title,
      excerpt: updatedPost.excerpt,
      content: updatedPost.content,
      status: updatedPost.status as "draft" | "published",
      coverImageUrl: updatedPost.coverImageUrl,
      seoTitle: updatedPost.seoTitle,
      seoDescription: updatedPost.seoDescription,
      publishedAt: updatedPost.publishedAt ? updatedPost.publishedAt.toISOString() : null,
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
      author: {
        username: user.username,
        displayName: user.displayName,
      },
    };
  }
}
