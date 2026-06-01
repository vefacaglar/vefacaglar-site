import { injectable } from "tsyringe";
import { CatalogLookupsService } from "./catalog-lookups.service";
import { GameRelationsService } from "./game-relations.service";
import { CreateGameData, GameRelationsData, GamesService, UpdateGameData } from "./games.service";
import type { Developer } from "./developers.repository.interface";
import type { Genre } from "./genres.repository.interface";
import type { GameWithRelations } from "./games.repository.interface";
import type { Platform } from "./platforms.repository.interface";
import type { Publisher } from "./publishers.repository.interface";
import type { Theme } from "./themes.repository.interface";

@injectable()
export class GameCatalogService {
  constructor(
    private readonly lookups: CatalogLookupsService,
    private readonly games: GamesService,
    private readonly relations: GameRelationsService
  ) {}

  createDeveloper(data: { name: string; slug: string; countryCode?: string }): Promise<Developer> {
    return this.lookups.createDeveloper(data);
  }

  getDeveloperById(id: string): Promise<Developer> {
    return this.lookups.getDeveloperById(id);
  }

  getDeveloperBySlug(slug: string): Promise<Developer> {
    return this.lookups.getDeveloperBySlug(slug);
  }

  listDevelopers(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Developer[]; total: number }> {
    return this.lookups.listDevelopers(filter);
  }

  updateDeveloper(id: string, data: { name?: string; slug?: string; countryCode?: string | null }): Promise<Developer> {
    return this.lookups.updateDeveloper(id, data);
  }

  deleteDeveloper(id: string): Promise<void> {
    return this.lookups.deleteDeveloper(id);
  }

  createPublisher(data: { name: string; slug: string; countryCode?: string }): Promise<Publisher> {
    return this.lookups.createPublisher(data);
  }

  getPublisherById(id: string): Promise<Publisher> {
    return this.lookups.getPublisherById(id);
  }

  getPublisherBySlug(slug: string): Promise<Publisher> {
    return this.lookups.getPublisherBySlug(slug);
  }

  listPublishers(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Publisher[]; total: number }> {
    return this.lookups.listPublishers(filter);
  }

  updatePublisher(id: string, data: { name?: string; slug?: string; countryCode?: string | null }): Promise<Publisher> {
    return this.lookups.updatePublisher(id, data);
  }

  deletePublisher(id: string): Promise<void> {
    return this.lookups.deletePublisher(id);
  }

  createGenre(data: { name: string; slug: string }): Promise<Genre> {
    return this.lookups.createGenre(data);
  }

  getGenreById(id: string): Promise<Genre> {
    return this.lookups.getGenreById(id);
  }

  getGenreBySlug(slug: string): Promise<Genre> {
    return this.lookups.getGenreBySlug(slug);
  }

  listGenres(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Genre[]; total: number }> {
    return this.lookups.listGenres(filter);
  }

  updateGenre(id: string, data: { name?: string; slug?: string }): Promise<Genre> {
    return this.lookups.updateGenre(id, data);
  }

  deleteGenre(id: string): Promise<void> {
    return this.lookups.deleteGenre(id);
  }

  createTheme(data: { name: string; slug: string }): Promise<Theme> {
    return this.lookups.createTheme(data);
  }

  getThemeById(id: string): Promise<Theme> {
    return this.lookups.getThemeById(id);
  }

  getThemeBySlug(slug: string): Promise<Theme> {
    return this.lookups.getThemeBySlug(slug);
  }

  listThemes(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Theme[]; total: number }> {
    return this.lookups.listThemes(filter);
  }

  updateTheme(id: string, data: { name?: string; slug?: string }): Promise<Theme> {
    return this.lookups.updateTheme(id, data);
  }

  deleteTheme(id: string): Promise<void> {
    return this.lookups.deleteTheme(id);
  }

  createPlatform(data: { name: string; slug: string }): Promise<Platform> {
    return this.lookups.createPlatform(data);
  }

  getPlatformById(id: string): Promise<Platform> {
    return this.lookups.getPlatformById(id);
  }

  getPlatformBySlug(slug: string): Promise<Platform> {
    return this.lookups.getPlatformBySlug(slug);
  }

  listPlatforms(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Platform[]; total: number }> {
    return this.lookups.listPlatforms(filter);
  }

  updatePlatform(id: string, data: { name?: string; slug?: string }): Promise<Platform> {
    return this.lookups.updatePlatform(id, data);
  }

  deletePlatform(id: string): Promise<void> {
    return this.lookups.deletePlatform(id);
  }

  createGame(data: CreateGameData, relations: GameRelationsData): Promise<GameWithRelations> {
    return this.games.createGame(data, relations);
  }

  getGameById(id: string): Promise<GameWithRelations> {
    return this.games.getGameById(id);
  }

  getGameBySlug(slug: string): Promise<GameWithRelations> {
    return this.games.getGameBySlug(slug);
  }

  listGames(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: GameWithRelations[]; total: number }> {
    return this.games.listGames(filter);
  }

  updateGame(id: string, data: UpdateGameData): Promise<GameWithRelations> {
    return this.games.updateGame(id, data);
  }

  deleteGame(id: string): Promise<void> {
    return this.games.deleteGame(id);
  }

  linkGameDeveloper(gameId: string, developerId: string): Promise<void> {
    return this.relations.linkGameDeveloper(gameId, developerId);
  }

  unlinkGameDeveloper(gameId: string, developerId: string): Promise<void> {
    return this.relations.unlinkGameDeveloper(gameId, developerId);
  }

  linkGamePublisher(gameId: string, publisherId: string): Promise<void> {
    return this.relations.linkGamePublisher(gameId, publisherId);
  }

  unlinkGamePublisher(gameId: string, publisherId: string): Promise<void> {
    return this.relations.unlinkGamePublisher(gameId, publisherId);
  }

  linkGameGenre(gameId: string, genreId: string): Promise<void> {
    return this.relations.linkGameGenre(gameId, genreId);
  }

  unlinkGameGenre(gameId: string, genreId: string): Promise<void> {
    return this.relations.unlinkGameGenre(gameId, genreId);
  }

  linkGamePlatform(gameId: string, platformId: string): Promise<void> {
    return this.relations.linkGamePlatform(gameId, platformId);
  }

  unlinkGamePlatform(gameId: string, platformId: string): Promise<void> {
    return this.relations.unlinkGamePlatform(gameId, platformId);
  }

  linkGameTheme(gameId: string, themeId: string): Promise<void> {
    return this.relations.linkGameTheme(gameId, themeId);
  }

  unlinkGameTheme(gameId: string, themeId: string): Promise<void> {
    return this.relations.unlinkGameTheme(gameId, themeId);
  }

  getRelationsOptions(): Promise<{ genres: Genre[]; platforms: Platform[]; themes: Theme[] }> {
    return this.relations.getRelationsOptions();
  }
}
