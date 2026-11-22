import type { PersonPage } from "./detail/detail.schema";
export const PEOPLE_REPOSITORY = Symbol("PeopleRepository");
export interface IPeopleRepository {
  findPublic(id: string, page: number, limit: number): Promise<Omit<PersonPage, "page" | "limit" | "totalPages"> | null>;
  resolveWikidata(wikidataId: string): Promise<{ id: string } | null>;
}
