import { FastifyRequest } from "fastify";
import { CreatePostRequest, PostResponse } from "./create.schema";
import { injectable, inject } from "tsyringe";
import { POSTS_REPOSITORY } from "../../posts.tokens";
import type { IPostsRepository } from "../../posts.repository.interface";
import { EVENT_BUS } from "../../../../shared/events/events.tokens";
import type { IEventBus } from "../../../../shared/events/event-bus";
import { postChanged } from "../../posts.events";

@injectable()
export class CreatePostHandler {
  constructor(
    @inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus
  ) {}

  async handle(request: FastifyRequest<{ Body: CreatePostRequest }>): Promise<PostResponse> {
    const user = request.user!;

    const { title, slug, excerpt, content, status, coverImageUrl, seoTitle, seoDescription } = request.body;

    const publishedAt = status === "published" ? new Date() : null;

    const newPost = await this.postsRepo.create({
      title,
      slug,
      excerpt: excerpt || null,
      content,
      status,
      coverImageUrl: coverImageUrl || null,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      publishedAt,
      authorId: user.id,
    });

    try {
      await this.eventBus.publish(postChanged(newPost.id));
    } catch {
      // best-effort; indexer will catch up via reindex
    }

    return {
      id: newPost.id,
      slug: newPost.slug,
      title: newPost.title,
      excerpt: newPost.excerpt,
      content: newPost.content,
      status: newPost.status as "draft" | "published",
      coverImageUrl: newPost.coverImageUrl,
      seoTitle: newPost.seoTitle,
      seoDescription: newPost.seoDescription,
      publishedAt: newPost.publishedAt ? newPost.publishedAt.toISOString() : null,
      createdAt: newPost.createdAt.toISOString(),
      updatedAt: newPost.updatedAt.toISOString(),
      author: {
        username: user.username,
        displayName: user.displayName,
      },
    };
  }
}
