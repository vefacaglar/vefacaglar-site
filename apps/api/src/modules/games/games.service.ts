import { injectable, inject } from "tsyringe";
import { DEVELOPERS_REPOSITORY } from "./games.tokens";
import type { IDevelopersRepository, Developer } from "./developers.repository.interface";
import { BadRequestError, NotFoundError } from "../../shared/http-errors";

@injectable()
export class GameService {
  constructor(
    @inject(DEVELOPERS_REPOSITORY) private readonly developersRepo: IDevelopersRepository
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
}
