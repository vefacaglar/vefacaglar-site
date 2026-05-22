import type { Post, NewPost, PostWithAuthor } from "./posts.repository";

export interface IPostsRepository {
  create(values: NewPost): Promise<Post>;
  findById(id: string): Promise<Post | null>;
  findBySlugWithAuthor(slug: string): Promise<PostWithAuthor | null>;
  listWithAuthor(filter?: { status?: "draft" | "published" }): Promise<PostWithAuthor[]>;
  listRawWithAuthor(filter?: { status?: "draft" | "published" }): Promise<PostWithAuthor[]>;
  update(id: string, patch: Partial<NewPost>): Promise<Post>;
  delete(id: string): Promise<void>;
  listPublishedByAuthorId(
    authorId: string
  ): Promise<Pick<Post, "id" | "slug" | "title" | "excerpt" | "publishedAt">[]>;
}
