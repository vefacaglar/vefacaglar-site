import { FastifyRequest } from "fastify";
import { CreatePublisherRequest, PublisherResponse } from "./create.schema";
import { injectable } from "tsyringe";
import { GameService } from "../../games.service";

@injectable()
export class CreatePublisherHandler {
  constructor(private readonly gameService: GameService) {}

  async handle(request: FastifyRequest<{ Body: CreatePublisherRequest }>): Promise<PublisherResponse> {
    const { name, slug, countryCode } = request.body;

    const newPub = await this.gameService.createPublisher({
      name,
      slug,
      countryCode,
    });

    return {
      id: newPub.id,
      name: newPub.name,
      slug: newPub.slug,
      countryCode: newPub.countryCode,
      createdAt: newPub.createdAt.toISOString(),
      updatedAt: newPub.updatedAt ? newPub.updatedAt.toISOString() : null,
    };
  }
}
