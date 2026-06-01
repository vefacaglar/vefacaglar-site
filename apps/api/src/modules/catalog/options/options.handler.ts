import { FastifyRequest } from "fastify";
import { injectable } from "tsyringe";
import { GameCatalogService } from "../catalog.service";
import { RelationsOptionsResponse } from "./options.schema";

@injectable()
export class RelationsOptionsHandler {
  constructor(private readonly catalogService: GameCatalogService) {}

  async handle(request: FastifyRequest): Promise<RelationsOptionsResponse> {
    const { genres, platforms, themes } = await this.catalogService.getRelationsOptions();

    return {
      genres: genres.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt ? g.updatedAt.toISOString() : null,
      })),
      themes: themes.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt ? t.updatedAt.toISOString() : null,
      })),
      platforms: platforms.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
      })),
    };
  }
}
