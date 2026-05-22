import { FastifyRequest } from "fastify";
import { GetAuthorParams, GetAuthorResponse } from "./detail.schema";
import { injectable, inject } from "tsyringe";
import { USERS_REPOSITORY } from "../../auth/auth.tokens";
import { POSTS_REPOSITORY } from "../../posts/posts.tokens";
import type { IUsersRepository } from "../../auth/users.repository.interface";
import type { IPostsRepository } from "../../posts/posts.repository.interface";
import { NotFoundError } from "../../../shared/http-errors";

@injectable()
export class GetAuthorHandler {
  constructor(
    @inject(USERS_REPOSITORY) private readonly usersRepo: IUsersRepository,
    @inject(POSTS_REPOSITORY) private readonly postsRepo: IPostsRepository
  ) {}

  async handle(request: FastifyRequest<{ Params: GetAuthorParams }>): Promise<GetAuthorResponse> {
    const { username } = request.params;

    const user = await this.usersRepo.findByUsername(username);

    if (!user) {
      throw new NotFoundError("Author not found.");
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
