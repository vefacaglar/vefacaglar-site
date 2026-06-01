import { inject, injectable } from "tsyringe";
import {
  DEVELOPERS_REPOSITORY,
  GENRES_REPOSITORY,
  PLATFORMS_REPOSITORY,
  PUBLISHERS_REPOSITORY,
  THEMES_REPOSITORY,
} from "./catalog.tokens";
import type { Developer, IDevelopersRepository } from "./developers.repository.interface";
import type { Genre, IGenresRepository } from "./genres.repository.interface";
import type { IPlatformsRepository, Platform } from "./platforms.repository.interface";
import type { IPublishersRepository, Publisher } from "./publishers.repository.interface";
import type { IThemesRepository, Theme } from "./themes.repository.interface";
import { EVENT_BUS } from "../../shared/events/events.tokens";
import type { IEventBus } from "../../shared/events/event-bus";
import { BadRequestError, NotFoundError } from "../../shared/http-errors";
import { entityChanged, entityRemoved, type GameEntityKind } from "./catalog.events";

@injectable()
export class CatalogLookupsService {
  constructor(
    @inject(DEVELOPERS_REPOSITORY) private readonly developersRepo: IDevelopersRepository,
    @inject(PUBLISHERS_REPOSITORY) private readonly publishersRepo: IPublishersRepository,
    @inject(GENRES_REPOSITORY) private readonly genresRepo: IGenresRepository,
    @inject(THEMES_REPOSITORY) private readonly themesRepo: IThemesRepository,
    @inject(PLATFORMS_REPOSITORY) private readonly platformsRepo: IPlatformsRepository,
    @inject(EVENT_BUS) private readonly eventBus: IEventBus
  ) {}

  private emitChanged(kind: GameEntityKind, id: string): Promise<void> {
    return this.eventBus.publish(entityChanged(kind, id));
  }

  private emitRemoved(kind: GameEntityKind, id: string): Promise<void> {
    return this.eventBus.publish(entityRemoved(kind, id));
  }

  async createDeveloper(data: { name: string; slug: string; countryCode?: string }): Promise<Developer> {
    const existing = await this.developersRepo.findBySlug(data.slug);
    if (existing) throw new BadRequestError("Developer with this slug already exists.");

    const created = await this.developersRepo.create({
      name: data.name,
      slug: data.slug,
      countryCode: data.countryCode || null,
    });
    await this.emitChanged("developer", created.id);
    return created;
  }

  async getDeveloperById(id: string): Promise<Developer> {
    const dev = await this.developersRepo.findById(id);
    if (!dev) throw new NotFoundError("Developer not found.");
    return dev;
  }

  async getDeveloperBySlug(slug: string): Promise<Developer> {
    const dev = await this.developersRepo.findBySlug(slug);
    if (!dev) throw new NotFoundError("Developer not found.");
    return dev;
  }

  async listDevelopers(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Developer[]; total: number }> {
    return this.developersRepo.list(filter);
  }

  async updateDeveloper(id: string, data: { name?: string; slug?: string; countryCode?: string | null }): Promise<Developer> {
    const existing = await this.developersRepo.findById(id);
    if (!existing) throw new NotFoundError("Developer not found.");

    if (data.slug && data.slug !== existing.slug) {
      const slugDup = await this.developersRepo.findBySlug(data.slug);
      if (slugDup) throw new BadRequestError("Developer with this slug already exists.");
    }

    const updated = await this.developersRepo.update(id, {
      name: data.name,
      slug: data.slug,
      countryCode: data.countryCode !== undefined ? (data.countryCode || null) : undefined,
      updatedAt: new Date(),
    });
    await this.emitChanged("developer", id);
    return updated;
  }

  async deleteDeveloper(id: string): Promise<void> {
    const existing = await this.developersRepo.findById(id);
    if (!existing) throw new NotFoundError("Developer not found.");
    await this.developersRepo.delete(id);
    await this.emitRemoved("developer", id);
  }

  async createPublisher(data: { name: string; slug: string; countryCode?: string }): Promise<Publisher> {
    const existing = await this.publishersRepo.findBySlug(data.slug);
    if (existing) throw new BadRequestError("Publisher with this slug already exists.");

    const created = await this.publishersRepo.create({
      name: data.name,
      slug: data.slug,
      countryCode: data.countryCode || null,
    });
    await this.emitChanged("publisher", created.id);
    return created;
  }

  async getPublisherById(id: string): Promise<Publisher> {
    const pub = await this.publishersRepo.findById(id);
    if (!pub) throw new NotFoundError("Publisher not found.");
    return pub;
  }

  async getPublisherBySlug(slug: string): Promise<Publisher> {
    const pub = await this.publishersRepo.findBySlug(slug);
    if (!pub) throw new NotFoundError("Publisher not found.");
    return pub;
  }

  async listPublishers(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Publisher[]; total: number }> {
    return this.publishersRepo.list(filter);
  }

  async updatePublisher(id: string, data: { name?: string; slug?: string; countryCode?: string | null }): Promise<Publisher> {
    const existing = await this.publishersRepo.findById(id);
    if (!existing) throw new NotFoundError("Publisher not found.");

    if (data.slug && data.slug !== existing.slug) {
      const slugDup = await this.publishersRepo.findBySlug(data.slug);
      if (slugDup) throw new BadRequestError("Publisher with this slug already exists.");
    }

    const updated = await this.publishersRepo.update(id, {
      name: data.name,
      slug: data.slug,
      countryCode: data.countryCode !== undefined ? (data.countryCode || null) : undefined,
      updatedAt: new Date(),
    });
    await this.emitChanged("publisher", id);
    return updated;
  }

  async deletePublisher(id: string): Promise<void> {
    const existing = await this.publishersRepo.findById(id);
    if (!existing) throw new NotFoundError("Publisher not found.");
    await this.publishersRepo.delete(id);
    await this.emitRemoved("publisher", id);
  }

  async createGenre(data: { name: string; slug: string }): Promise<Genre> {
    const existing = await this.genresRepo.findBySlug(data.slug);
    if (existing) throw new BadRequestError("Genre with this slug already exists.");

    const created = await this.genresRepo.create({ name: data.name, slug: data.slug });
    await this.emitChanged("genre", created.id);
    return created;
  }

  async getGenreById(id: string): Promise<Genre> {
    const genre = await this.genresRepo.findById(id);
    if (!genre) throw new NotFoundError("Genre not found.");
    return genre;
  }

  async getGenreBySlug(slug: string): Promise<Genre> {
    const genre = await this.genresRepo.findBySlug(slug);
    if (!genre) throw new NotFoundError("Genre not found.");
    return genre;
  }

  async listGenres(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Genre[]; total: number }> {
    return this.genresRepo.list(filter);
  }

  async updateGenre(id: string, data: { name?: string; slug?: string }): Promise<Genre> {
    const existing = await this.genresRepo.findById(id);
    if (!existing) throw new NotFoundError("Genre not found.");

    if (data.slug && data.slug !== existing.slug) {
      const slugDup = await this.genresRepo.findBySlug(data.slug);
      if (slugDup) throw new BadRequestError("Genre with this slug already exists.");
    }

    const updated = await this.genresRepo.update(id, {
      name: data.name,
      slug: data.slug,
      updatedAt: new Date(),
    });
    await this.emitChanged("genre", id);
    return updated;
  }

  async deleteGenre(id: string): Promise<void> {
    const existing = await this.genresRepo.findById(id);
    if (!existing) throw new NotFoundError("Genre not found.");
    await this.genresRepo.delete(id);
    await this.emitRemoved("genre", id);
  }

  async createTheme(data: { name: string; slug: string }): Promise<Theme> {
    const existing = await this.themesRepo.findBySlug(data.slug);
    if (existing) throw new BadRequestError("Theme with this slug already exists.");

    const created = await this.themesRepo.create({ name: data.name, slug: data.slug });
    await this.emitChanged("theme", created.id);
    return created;
  }

  async getThemeById(id: string): Promise<Theme> {
    const theme = await this.themesRepo.findById(id);
    if (!theme) throw new NotFoundError("Theme not found.");
    return theme;
  }

  async getThemeBySlug(slug: string): Promise<Theme> {
    const theme = await this.themesRepo.findBySlug(slug);
    if (!theme) throw new NotFoundError("Theme not found.");
    return theme;
  }

  async listThemes(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Theme[]; total: number }> {
    return this.themesRepo.list(filter);
  }

  async updateTheme(id: string, data: { name?: string; slug?: string }): Promise<Theme> {
    const existing = await this.themesRepo.findById(id);
    if (!existing) throw new NotFoundError("Theme not found.");

    if (data.slug && data.slug !== existing.slug) {
      const slugDup = await this.themesRepo.findBySlug(data.slug);
      if (slugDup) throw new BadRequestError("Theme with this slug already exists.");
    }

    const updated = await this.themesRepo.update(id, {
      name: data.name,
      slug: data.slug,
      updatedAt: new Date(),
    });
    await this.emitChanged("theme", id);
    return updated;
  }

  async deleteTheme(id: string): Promise<void> {
    const existing = await this.themesRepo.findById(id);
    if (!existing) throw new NotFoundError("Theme not found.");
    await this.themesRepo.delete(id);
    await this.emitRemoved("theme", id);
  }

  async createPlatform(data: { name: string; slug: string }): Promise<Platform> {
    const existing = await this.platformsRepo.findBySlug(data.slug);
    if (existing) throw new BadRequestError("Platform with this slug already exists.");

    const created = await this.platformsRepo.create({ name: data.name, slug: data.slug });
    await this.emitChanged("platform", created.id);
    return created;
  }

  async getPlatformById(id: string): Promise<Platform> {
    const platform = await this.platformsRepo.findById(id);
    if (!platform) throw new NotFoundError("Platform not found.");
    return platform;
  }

  async getPlatformBySlug(slug: string): Promise<Platform> {
    const platform = await this.platformsRepo.findBySlug(slug);
    if (!platform) throw new NotFoundError("Platform not found.");
    return platform;
  }

  async listPlatforms(filter?: { page?: number; limit?: number; q?: string }): Promise<{ items: Platform[]; total: number }> {
    return this.platformsRepo.list(filter);
  }

  async updatePlatform(id: string, data: { name?: string; slug?: string }): Promise<Platform> {
    const existing = await this.platformsRepo.findById(id);
    if (!existing) throw new NotFoundError("Platform not found.");

    if (data.slug && data.slug !== existing.slug) {
      const slugDup = await this.platformsRepo.findBySlug(data.slug);
      if (slugDup) throw new BadRequestError("Platform with this slug already exists.");
    }

    const updated = await this.platformsRepo.update(id, {
      name: data.name,
      slug: data.slug,
      updatedAt: new Date(),
    });
    await this.emitChanged("platform", id);
    return updated;
  }

  async deletePlatform(id: string): Promise<void> {
    const existing = await this.platformsRepo.findById(id);
    if (!existing) throw new NotFoundError("Platform not found.");
    await this.platformsRepo.delete(id);
    await this.emitRemoved("platform", id);
  }
}
