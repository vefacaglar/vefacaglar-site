import { FastifyRequest } from "fastify";
import { UpdatePublisherParams, UpdatePublisherRequest, PublisherResponse } from "./update.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class UpdatePublisherHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Params: UpdatePublisherParams; Body: UpdatePublisherRequest }>): Promise<PublisherResponse> {
    const { id } = request.params;
    const { name, slug, countryCode } = request.body;

    const updatedPub = await this.gameService.updatePublisher(id, {
      name,
      slug,
      countryCode,
    });

    return {
      id: updatedPub.id,
      name: updatedPub.name,
      slug: updatedPub.slug,
      countryCode: updatedPub.countryCode,
      createdAt: updatedPub.createdAt.toISOString(),
      updatedAt: updatedPub.updatedAt ? updatedPub.updatedAt.toISOString() : null,
    };
  }
}
