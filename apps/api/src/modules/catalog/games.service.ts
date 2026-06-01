import { inject, injectable } from "tsyringe";
import { GAMES_REPOSITORY } from "./catalog.tokens";
import type { GameWithRelations, IGamesRepository, NewGame } from "./games.repository.interface";
import { EVENT_BUS } from "../../shared/events/events.tokens";
import type { IEventBus } from "../../shared/events/event-bus";
import { BadRequestError, NotFoundError } from "../../shared/http-errors";
import { entityChanged, entityRemoved } from "./catalog.events";

export type CreateGameData = {
  title: string;
  slug: string;
  originalTitle?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  releaseDate?: string | null;
  metacriticScore?: number | null;
  openCriticScore?: number | null;
  hltbMainHours?: string | number | null;
  hltbMainExtraHours?: string | number | null;
  hltbCompletionistHours?: string | number | null;
};

export type GameRelationsData = {
  developerIds?: string[];
  publisherIds?: string[];
  genreIds?: string[];
  platformIds?: string[];
  themeIds?: string[];
};

export type UpdateGameData = Partial<CreateGameData>;

@injectable()
export class GamesService {
  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus
  ) {}

  async createGame(data: CreateGameData, relations: GameRelationsData): Promise<GameWithRelations> {
    const existing = await this.gamesRepo.findBySlug(data.slug);
    if (existing) throw new BadRequestError("Game with this slug already exists.");

    const game = await this.gamesRepo.create(
      {
        title: data.title,
        slug: data.slug,
        originalTitle: data.originalTitle || null,
        description: data.description || null,
        coverImageUrl: data.coverImageUrl || null,
        releaseDate: data.releaseDate || null,
        metacriticScore: data.metacriticScore || null,
        openCriticScore: data.openCriticScore || null,
        hltbMainHours: data.hltbMainHours ? String(data.hltbMainHours) : null,
        hltbMainExtraHours: data.hltbMainExtraHours ? String(data.hltbMainExtraHours) : null,
        hltbCompletionistHours: data.hltbCompletionistHours ? String(data.hltbCompletionistHours) : null,
      },
      relations
    );
    await this.eventBus.publish(entityChanged("game", game.id));
    return game;
  }

  async getGameById(id: string): Promise<GameWithRelations> {
    const game = await this.gamesRepo.findById(id);
    if (!game) throw new NotFoundError("Game not found.");
    return game;
  }

  async getGameBySlug(slug: string): Promise<GameWithRelations> {
    const game = await this.gamesRepo.findBySlug(slug);
    if (!game) throw new NotFoundError("Game not found.");
    return game;
  }

  async listGames(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: GameWithRelations[]; total: number }> {
    return this.gamesRepo.list(filter);
  }

  async updateGame(id: string, data: UpdateGameData): Promise<GameWithRelations> {
    const existing = await this.gamesRepo.findById(id);
    if (!existing) throw new NotFoundError("Game not found.");

    if (data.slug && data.slug !== existing.slug) {
      const slugDup = await this.gamesRepo.findBySlug(data.slug);
      if (slugDup) throw new BadRequestError("Game with this slug already exists.");
    }

    const patch: Partial<NewGame> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.slug !== undefined) patch.slug = data.slug;
    if (data.originalTitle !== undefined) patch.originalTitle = data.originalTitle || null;
    if (data.description !== undefined) patch.description = data.description || null;
    if (data.coverImageUrl !== undefined) patch.coverImageUrl = data.coverImageUrl || null;
    if (data.releaseDate !== undefined) patch.releaseDate = data.releaseDate || null;
    if (data.metacriticScore !== undefined) patch.metacriticScore = data.metacriticScore;
    if (data.openCriticScore !== undefined) patch.openCriticScore = data.openCriticScore;
    if (data.hltbMainHours !== undefined) patch.hltbMainHours = data.hltbMainHours ? String(data.hltbMainHours) : null;
    if (data.hltbMainExtraHours !== undefined) patch.hltbMainExtraHours = data.hltbMainExtraHours ? String(data.hltbMainExtraHours) : null;
    if (data.hltbCompletionistHours !== undefined) patch.hltbCompletionistHours = data.hltbCompletionistHours ? String(data.hltbCompletionistHours) : null;
    patch.updatedAt = new Date();

    const updated = await this.gamesRepo.update(id, patch);
    await this.eventBus.publish(entityChanged("game", id));
    return updated;
  }

  async deleteGame(id: string): Promise<void> {
    const existing = await this.gamesRepo.findById(id);
    if (!existing) throw new NotFoundError("Game not found.");
    await this.gamesRepo.delete(id);
    await this.eventBus.publish(entityRemoved("game", id));
  }
}
