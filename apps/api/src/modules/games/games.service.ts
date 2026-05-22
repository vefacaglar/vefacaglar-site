import { injectable, inject } from "tsyringe";
import { DEVELOPERS_REPOSITORY, PUBLISHERS_REPOSITORY, GENRES_REPOSITORY } from "./games.tokens";
import type { IDevelopersRepository, Developer } from "./developers.repository.interface";
import type { IPublishersRepository, Publisher } from "./publishers.repository.interface";
import type { IGenresRepository, Genre } from "./genres.repository.interface";
import { BadRequestError, NotFoundError } from "../../shared/http-errors";

@injectable()
export class GameService {
  constructor(
    @inject(DEVELOPERS_REPOSITORY) private readonly developersRepo: IDevelopersRepository,
    @inject(PUBLISHERS_REPOSITORY) private readonly publishersRepo: IPublishersRepository,
    @inject(GENRES_REPOSITORY) private readonly genresRepo: IGenresRepository
  ) {}

  // --- Developer CRUD Methods ---

  async createDeveloper(data: { name: string; slug: string; countryCode?: string }): Promise<Developer> {
    const existing = await this.developersRepo.findBySlug(data.slug);
    if (existing) {
      throw new BadRequestError("Developer with this slug already exists.");
    }
    return this.developersRepo.create({
      name: data.name,
      slug: data.slug,
      countryCode: data.countryCode || null,
    });
  }

  async getDeveloperById(id: string): Promise<Developer> {
    const dev = await this.developersRepo.findById(id);
    if (!dev) {
      throw new NotFoundError("Developer not found.");
    }
    return dev;
  }

  async getDeveloperBySlug(slug: string): Promise<Developer> {
    const dev = await this.developersRepo.findBySlug(slug);
    if (!dev) {
      throw new NotFoundError("Developer not found.");
    }
    return dev;
  }

  async listDevelopers(filter?: { page?: number; limit?: number }): Promise<{ items: Developer[]; total: number }> {
    return this.developersRepo.list(filter);
  }

  async updateDeveloper(id: string, data: { name?: string; slug?: string; countryCode?: string | null }): Promise<Developer> {
    const existing = await this.developersRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Developer not found.");
    }

    if (data.slug && data.slug !== existing.slug) {
      const slugDup = await this.developersRepo.findBySlug(data.slug);
      if (slugDup) {
        throw new BadRequestError("Developer with this slug already exists.");
      }
    }

    return this.developersRepo.update(id, {
      name: data.name,
      slug: data.slug,
      countryCode: data.countryCode !== undefined ? (data.countryCode || null) : undefined,
      updatedAt: new Date(),
    });
  }

  async deleteDeveloper(id: string): Promise<void> {
    const existing = await this.developersRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Developer not found.");
    }
    await this.developersRepo.delete(id);
  }

  // --- Publisher CRUD Methods ---

  async createPublisher(data: { name: string; slug: string; countryCode?: string }): Promise<Publisher> {
    const existing = await this.publishersRepo.findBySlug(data.slug);
    if (existing) {
      throw new BadRequestError("Publisher with this slug already exists.");
    }
    return this.publishersRepo.create({
      name: data.name,
      slug: data.slug,
      countryCode: data.countryCode || null,
    });
  }

  async getPublisherById(id: string): Promise<Publisher> {
    const pub = await this.publishersRepo.findById(id);
    if (!pub) {
      throw new NotFoundError("Publisher not found.");
    }
    return pub;
  }

  async getPublisherBySlug(slug: string): Promise<Publisher> {
    const pub = await this.publishersRepo.findBySlug(slug);
    if (!pub) {
      throw new NotFoundError("Publisher not found.");
    }
    return pub;
  }

  async listPublishers(filter?: { page?: number; limit?: number }): Promise<{ items: Publisher[]; total: number }> {
    return this.publishersRepo.list(filter);
  }

  async updatePublisher(id: string, data: { name?: string; slug?: string; countryCode?: string | null }): Promise<Publisher> {
    const existing = await this.publishersRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Publisher not found.");
    }

    if (data.slug && data.slug !== existing.slug) {
      const slugDup = await this.publishersRepo.findBySlug(data.slug);
      if (slugDup) {
        throw new BadRequestError("Publisher with this slug already exists.");
      }
    }

    return this.publishersRepo.update(id, {
      name: data.name,
      slug: data.slug,
      countryCode: data.countryCode !== undefined ? (data.countryCode || null) : undefined,
      updatedAt: new Date(),
    });
  }

  async deletePublisher(id: string): Promise<void> {
    const existing = await this.publishersRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Publisher not found.");
    }
    await this.publishersRepo.delete(id);
  }

  // --- Genre CRUD Methods ---

  async createGenre(data: { name: string; slug: string }): Promise<Genre> {
    const existing = await this.genresRepo.findBySlug(data.slug);
    if (existing) {
      throw new BadRequestError("Genre with this slug already exists.");
    }
    return this.genresRepo.create({
      name: data.name,
      slug: data.slug,
    });
  }

  async getGenreById(id: string): Promise<Genre> {
    const genre = await this.genresRepo.findById(id);
    if (!genre) {
      throw new NotFoundError("Genre not found.");
    }
    return genre;
  }

  async getGenreBySlug(slug: string): Promise<Genre> {
    const genre = await this.genresRepo.findBySlug(slug);
    if (!genre) {
      throw new NotFoundError("Genre not found.");
    }
    return genre;
  }

  async listGenres(filter?: { page?: number; limit?: number }): Promise<{ items: Genre[]; total: number }> {
    return this.genresRepo.list(filter);
  }

  async updateGenre(id: string, data: { name?: string; slug?: string }): Promise<Genre> {
    const existing = await this.genresRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Genre not found.");
    }

    if (data.slug && data.slug !== existing.slug) {
      const slugDup = await this.genresRepo.findBySlug(data.slug);
      if (slugDup) {
        throw new BadRequestError("Genre with this slug already exists.");
      }
    }

    return this.genresRepo.update(id, {
      name: data.name,
      slug: data.slug,
      updatedAt: new Date(),
    });
  }

  async deleteGenre(id: string): Promise<void> {
    const existing = await this.genresRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Genre not found.");
    }
    await this.genresRepo.delete(id);
  }
}
