import { FastifyRequest } from "fastify";
import { GetPublisherParams, PublisherResponse } from "./detail.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class GetPublisherHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: GetPublisherParams }>): Promise<PublisherResponse> {
    const { id } = request.params;

    const pub = await this.gameService.getPublisherById(id);

    return {
      id: pub.id,
      name: pub.name,
      slug: pub.slug,
      countryCode: pub.countryCode,
      createdAt: pub.createdAt.toISOString(),
      updatedAt: pub.updatedAt ? pub.updatedAt.toISOString() : null,
    };
  }
}
