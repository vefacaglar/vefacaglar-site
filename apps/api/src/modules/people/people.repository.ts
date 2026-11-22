import { injectable } from "tsyringe";
import { and, eq, sql } from "drizzle-orm";
import { moviePeople, moviePersonAliases, moviePersonSources, movieCredits, movies, tvCast, tvSeries } from "@vefacaglar/db";
import { DbProvider } from "../../db.provider";
import type { IPeopleRepository } from "./people.repository.interface";
import type { PersonCredit } from "./detail/detail.schema";
type RawRole = { property: string; characters: (string | null)[]; voice?: boolean | null; self?: boolean | null };
type CreditRow = { kind: "film" | "tv_series"; sourceId: string; title: string; slug: string | null; releaseYear: number | null; roleDetails: RawRole[] };
const ROLE_NAMES = { P161: "cast", P57: "director", P162: "producer", cast: "cast" } as const;

@injectable()
export class DrizzlePeopleRepository implements IPeopleRepository {
  constructor(private readonly dbProvider: DbProvider) {}

  private async canonicalPerson(id: string) {
    const [alias] = await this.dbProvider.client.select().from(moviePersonAliases).where(eq(moviePersonAliases.aliasId, id));
    const [person] = await this.dbProvider.client.select().from(moviePeople).where(eq(moviePeople.id, alias?.personId ?? id));
    return person ?? null;
  }

  private credits(personId: string) {
    return sql`
      select 'film'::text as kind, ${movies.id}::text as "sourceId", ${movies.title} as title, ${movies.slug} as slug,
        ${movies.releaseYear} as "releaseYear",
        jsonb_agg(jsonb_build_object('property', ${movieCredits.roleProperty}, 'characters', ${movieCredits.characterNames})
          order by ${movieCredits.roleProperty}, ${movieCredits.statementId}) as "roleDetails"
      from ${movieCredits} join ${movies} on ${movies.id} = ${movieCredits.movieId}
      where ${movieCredits.personId} = ${personId} and ${movieCredits.rank} <> 'deprecated'
        and ${movieCredits.roleProperty} in ('P161', 'P57', 'P162')
        and ${movies.isFilm} = true and ${movies.hydratedAt} is not null and ${movies.title} is not null
      group by ${movies.id}, ${movies.title}, ${movies.slug}, ${movies.releaseYear}
      union all
      select 'tv_series'::text as kind, ${tvSeries.id}::text as "sourceId", ${tvSeries.name} as title, null::text as slug,
        extract(year from ${tvSeries.premiered})::int as "releaseYear",
        jsonb_agg(jsonb_build_object('property', 'cast', 'characters', jsonb_build_array(${tvCast.characterName}),
          'voice', ${tvCast.voice}, 'self', ${tvCast.self}) order by ${tvCast.castOrder}, ${tvCast.characterId}) as "roleDetails"
      from ${tvCast} join ${tvSeries} on ${tvSeries.id} = ${tvCast.seriesId}
      where ${tvCast.personId} = ${personId} and ${tvSeries.isDeleted} = false
      group by ${tvSeries.id}, ${tvSeries.name}, ${tvSeries.premiered}`;
  }

  async resolveWikidata(wikidataId: string) {
    const [found] = await this.dbProvider.client.select({ id: moviePeople.id }).from(moviePeople).where(eq(moviePeople.wikidataId, wikidataId));
    if (!found) return null;
    const person = await this.canonicalPerson(found.id);
    if (!person) return null;
    const visible = await this.dbProvider.client.execute(sql`select 1 from (${this.credits(person.id)}) credits limit 1`);
    return visible.length ? { id: person.id } : null;
  }

  async findPublic(id: string, page: number, limit: number) {
    const person = await this.canonicalPerson(id);
    if (!person) return null;
    const credits = this.credits(person.id);
    const [totals, rows, sources] = await Promise.all([
      this.dbProvider.client.execute(sql`select count(*)::int as total from (${credits}) credits`),
      this.dbProvider.client.execute(sql`select * from (${credits}) credits
        order by "releaseYear" desc nulls last, lower(title) asc, kind asc, "sourceId" asc
        limit ${limit} offset ${(page - 1) * limit}`),
      this.dbProvider.client.select().from(moviePersonSources).where(and(eq(moviePersonSources.personId, person.id), eq(moviePersonSources.provider, "tvmaze"))),
    ]);
    const total = Number(totals[0]?.total ?? 0);
    if (total === 0) return null;
    const source = sources[0];
    return {
      person: { id: person.id, name: person.name?.trim() || source?.sourceName?.trim() || person.wikidataId || "Unnamed person",
        wikidataId: person.wikidataId, birthDate: source?.birthDate ?? null, deathDate: source?.deathDate ?? null,
        gender: source?.gender ?? null, country: source?.country ?? null,
        sources: sources.filter((item) => /^[1-9]\d*$/.test(item.externalId)).map((item) => ({ provider: "tvmaze" as const,
          sourceUrl: `https://www.tvmaze.com/people/${item.externalId}` })) },
      total,
      items: (rows as unknown as CreditRow[]).map((row): PersonCredit => {
        const roles = [...new Set(row.roleDetails.flatMap((role) => role.property in ROLE_NAMES
          ? [ROLE_NAMES[role.property as keyof typeof ROLE_NAMES]] : []))];
        const characters = [...new Set(row.roleDetails.flatMap((role) => role.characters.filter((name): name is string => !!name?.trim())))];
        const shared = { title: row.title, releaseYear: row.releaseYear, roles, characters,
          voice: row.roleDetails.some((role) => role.voice === true), self: row.roleDetails.some((role) => role.self === true) };
        return row.kind === "film" ? { ...shared, kind: "film", id: row.sourceId, slug: row.slug! }
          : { ...shared, kind: "tv_series", id: Number(row.sourceId) };
      }),
    };
  }
}
