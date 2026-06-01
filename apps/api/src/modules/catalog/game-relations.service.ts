import { inject, injectable } from "tsyringe";
import {
  DEVELOPERS_REPOSITORY,
  GAMES_REPOSITORY,
  GENRES_REPOSITORY,
  PLATFORMS_REPOSITORY,
  PUBLISHERS_REPOSITORY,
  THEMES_REPOSITORY,
} from "./catalog.tokens";
import type { IDevelopersRepository } from "./developers.repository.interface";
import type { Genre, IGenresRepository } from "./genres.repository.interface";
import type { IGamesRepository } from "./games.repository.interface";
import type { IPlatformsRepository, Platform } from "./platforms.repository.interface";
import type { IPublishersRepository } from "./publishers.repository.interface";
import type { IThemesRepository, Theme } from "./themes.repository.interface";
import { DbProvider } from "../../db.provider";
import { EVENT_BUS } from "../../shared/events/events.tokens";
import type { IEventBus } from "../../shared/events/event-bus";
import { NotFoundError } from "../../shared/http-errors";
import { entityChanged } from "./catalog.events";

@injectable()
export class GameRelationsService {
  constructor(
    @inject(GAMES_REPOSITORY) private readonly gamesRepo: IGamesRepository,
    @inject(DEVELOPERS_REPOSITORY) private readonly developersRepo: IDevelopersRepository,
    @inject(PUBLISHERS_REPOSITORY) private readonly publishersRepo: IPublishersRepository,
    @inject(GENRES_REPOSITORY) private readonly genresRepo: IGenresRepository,
    @inject(THEMES_REPOSITORY) private readonly themesRepo: IThemesRepository,
    @inject(PLATFORMS_REPOSITORY) private readonly platformsRepo: IPlatformsRepository,
    private readonly dbProvider: DbProvider,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus
  ) {}

  private async assertGameExists(gameId: string): Promise<void> {
    const game = await this.gamesRepo.findById(gameId);
    if (!game) throw new NotFoundError("Game not found.");
  }

  private emitGameChanged(gameId: string): Promise<void> {
    return this.eventBus.publish(entityChanged("game", gameId));
  }

  async linkGameDeveloper(gameId: string, developerId: string): Promise<void> {
    await this.assertGameExists(gameId);
    const dev = await this.developersRepo.findById(developerId);
    if (!dev) throw new NotFoundError("Developer not found.");
    await this.gamesRepo.linkDeveloper(gameId, developerId);
    await this.emitGameChanged(gameId);
  }

  async unlinkGameDeveloper(gameId: string, developerId: string): Promise<void> {
    await this.assertGameExists(gameId);
    await this.gamesRepo.unlinkDeveloper(gameId, developerId);
    await this.emitGameChanged(gameId);
  }

  async linkGamePublisher(gameId: string, publisherId: string): Promise<void> {
    await this.assertGameExists(gameId);
    const pub = await this.publishersRepo.findById(publisherId);
    if (!pub) throw new NotFoundError("Publisher not found.");
    await this.gamesRepo.linkPublisher(gameId, publisherId);
    await this.emitGameChanged(gameId);
  }

  async unlinkGamePublisher(gameId: string, publisherId: string): Promise<void> {
    await this.assertGameExists(gameId);
    await this.gamesRepo.unlinkPublisher(gameId, publisherId);
    await this.emitGameChanged(gameId);
  }

  async linkGameGenre(gameId: string, genreId: string): Promise<void> {
    await this.assertGameExists(gameId);
    const genre = await this.genresRepo.findById(genreId);
    if (!genre) throw new NotFoundError("Genre not found.");
    await this.gamesRepo.linkGenre(gameId, genreId);
    await this.emitGameChanged(gameId);
  }

  async unlinkGameGenre(gameId: string, genreId: string): Promise<void> {
    await this.assertGameExists(gameId);
    await this.gamesRepo.unlinkGenre(gameId, genreId);
    await this.emitGameChanged(gameId);
  }

  async linkGamePlatform(gameId: string, platformId: string): Promise<void> {
    await this.assertGameExists(gameId);
    const platform = await this.platformsRepo.findById(platformId);
    if (!platform) throw new NotFoundError("Platform not found.");
    await this.gamesRepo.linkPlatform(gameId, platformId);
    await this.emitGameChanged(gameId);
  }

  async unlinkGamePlatform(gameId: string, platformId: string): Promise<void> {
    await this.assertGameExists(gameId);
    await this.gamesRepo.unlinkPlatform(gameId, platformId);
    await this.emitGameChanged(gameId);
  }

  async linkGameTheme(gameId: string, themeId: string): Promise<void> {
    await this.assertGameExists(gameId);
    const theme = await this.themesRepo.findById(themeId);
    if (!theme) throw new NotFoundError("Theme not found.");
    await this.gamesRepo.linkTheme(gameId, themeId);
    await this.emitGameChanged(gameId);
  }

  async unlinkGameTheme(gameId: string, themeId: string): Promise<void> {
    await this.assertGameExists(gameId);
    await this.gamesRepo.unlinkTheme(gameId, themeId);
    await this.emitGameChanged(gameId);
  }

  async getRelationsOptions(): Promise<{ genres: Genre[]; platforms: Platform[]; themes: Theme[] }> {
    return this.dbProvider.transaction(async () => {
      const [genresRes, platformsRes, themesRes] = await Promise.all([
        this.genresRepo.list({ limit: 1000 }),
        this.platformsRepo.list({ limit: 1000 }),
        this.themesRepo.list({ limit: 1000 }),
      ]);
      return {
        genres: genresRes.items,
        platforms: platformsRes.items,
        themes: themesRes.items,
      };
    });
  }
}
