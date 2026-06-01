import type { Post, NewPost, PostWithAuthor, PostListItem } from "./posts.repository";

export interface IPostsRepository {
  create(values: NewPost): Promise<Post>;
  findById(id: string): Promise<Post | null>;
  findByIdWithAuthor(id: string): Promise<PostWithAuthor | null>;
  findBySlugWithAuthor(slug: string): Promise<PostWithAuthor | null>;
  listWithAuthor(filter?: { status?: "draft" | "published"; q?: string; page?: number; limit?: number }): Promise<{ items: PostListItem[]; total: number }>;
  listRawWithAuthor(filter?: { status?: "draft" | "published"; q?: string; page?: number; limit?: number }): Promise<{ items: PostWithAuthor[]; total: number }>;
  update(id: string, patch: Partial<NewPost>): Promise<Post>;
  delete(id: string): Promise<void>;
  listPublishedByAuthorId(
    authorId: string
  ): Promise<Pick<Post, "id" | "slug" | "title" | "excerpt" | "publishedAt">[]>;
}
