import { FastifyRequest } from "fastify";
import { ListPostsQuery, ListPostsResponse } from "./list.schema";
import type { PostSearchItem } from "../../../shared/search/mappers/post.mapper";
import { injectable, inject } from "tsyringe";
import { SEARCH_READER } from "../../../shared/search/search.tokens";
import type { ISearchReader } from "../../../shared/search/queries/search-reader.interface";

@injectable()
export class ListPostsHandler {
  constructor(@inject(SEARCH_READER) private readonly searchReader: ISearchReader) {}

  async handle(request: FastifyRequest<{ Querystring: ListPostsQuery }>): Promise<ListPostsResponse> {
    const { page, limit, q } = request.query;

    const pageNum = page !== undefined ? Number(page) : 1;
    const limitNum = limit !== undefined ? Number(limit) : 10;

    const { items: rows, total } = await this.searchReader.searchPosts({
      q,
      page: pageNum,
      limit: limitNum,
    });
    const totalPages = Math.ceil(total / limitNum);

    const items = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      status: "published" as const,
      coverImageUrl: row.coverImageUrl,
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: row.author,
    }));

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    };
  }
}
