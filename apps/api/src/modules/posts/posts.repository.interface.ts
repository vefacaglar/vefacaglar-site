import type { Post, NewPost, PostWithAuthor } from "./posts.repository";

export interface IPostsRepository {
  create(values: NewPost): Promise<Post>;
  findById(id: string, lang?: string): Promise<Post | null>;
  findBySlugWithAuthor(slug: string, lang?: string): Promise<PostWithAuthor | null>;
  listWithAuthor(filter?: { status?: "draft" | "published" }, lang?: string): Promise<PostWithAuthor[]>;
  update(id: string, patch: Partial<NewPost>): Promise<Post>;
  delete(id: string): Promise<void>;
  listPublishedByAuthorId(
    authorId: string,
    lang?: string
  ): Promise<Pick<Post, "id" | "slug" | "title" | "excerpt" | "publishedAt">[]>;
}
