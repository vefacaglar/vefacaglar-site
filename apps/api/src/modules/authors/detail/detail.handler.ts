import { FastifyRequest } from "fastify";
import { GetAuthorParams, GetAuthorResponse } from "./detail.schema";
import { UsersRepository } from "../../auth/users.repository";
import { PostsRepository } from "../../posts/posts.repository";

export class GetAuthorHandler {
  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly postsRepo: PostsRepository
  ) {}

  async handle(request: FastifyRequest<{ Params: GetAuthorParams }>): Promise<GetAuthorResponse> {
    const { username } = request.params;

    const user = await this.usersRepo.findByUsername(username);

    if (!user) {
      throw new Error("AuthorNotFound");
    }

    const authorPosts = await this.postsRepo.listPublishedByAuthorId(user.id);

    return {
      username: user.username,
      displayName: user.displayName,
      posts: authorPosts.map((post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      })),
    };
  }
}
