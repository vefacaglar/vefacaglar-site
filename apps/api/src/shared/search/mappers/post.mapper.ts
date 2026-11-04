import type { PostWithAuthor } from "../../../modules/posts/posts.repository";
import { stripMdx } from "./strip-mdx";

export interface PostDoc {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  content?: string;
  coverImageUrl?: string;
  seoTitle?: string;
  seoDescription?: string;
  authorUsername?: string;
  authorDisplayName?: string;
  publishedAt: number;
  createdAt: number;
  updatedAt?: number;
}

export type PostSearchItem = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly status: "draft" | "published";
  readonly coverImageUrl: string | null;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  readonly publishedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author: { username: string; displayName: string } | null;
};

function toUnixSeconds(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const d = value instanceof Date ? value : new Date(value);
  return Math.floor(d.getTime() / 1000);
}

/** Maps a post's default (English) content to its search document. */
export function toPostDoc(post: PostWithAuthor): PostDoc {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt ?? undefined,
    content: stripMdx(post.content ?? "") || undefined,
    coverImageUrl: post.coverImageUrl ?? undefined,
    seoTitle: post.seoTitle ?? undefined,
    seoDescription: post.seoDescription ?? undefined,
    authorUsername: post.authorUsername ?? undefined,
    authorDisplayName: post.authorDisplayName ?? undefined,
    publishedAt: toUnixSeconds(post.publishedAt),
    createdAt: toUnixSeconds(post.createdAt),
    updatedAt: post.updatedAt ? toUnixSeconds(post.updatedAt) : undefined,
  };
}

export function postFromDoc(doc: PostDoc): PostSearchItem {
  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    excerpt: doc.excerpt ?? null,
    status: "published" as const,
    coverImageUrl: doc.coverImageUrl ?? null,
    seoTitle: doc.seoTitle ?? null,
    seoDescription: doc.seoDescription ?? null,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt * 1000).toISOString() : null,
    createdAt: new Date(doc.createdAt * 1000).toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt * 1000).toISOString() : new Date(doc.createdAt * 1000).toISOString(),
    author: doc.authorUsername && doc.authorDisplayName
      ? { username: doc.authorUsername, displayName: doc.authorDisplayName }
      : null,
  };
}
