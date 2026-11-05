import { injectable } from "tsyringe";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { movies, moviePeople, movieCompanies, movieGenres, movieEntityLabels, movieCredits, movieCompanyLinks, movieGenreLinks, movieSourceState } from "@vefacaglar/db";
import { DbProvider } from "../../db.provider";
import type { IMoviesRepository, MovieSourceState } from "./movies.repository.interface";
import { MOVIE_SEEDS, MOVIE_SOURCE_ID, type EntityLabels, type NormalizedMovie } from "./import/movie-source.types";
import { characterQidsFromQualifiers, isQid, movieSlug, movieSnapshotDisposition } from "./import/wikidata-normalizer";

const publicMovie = () => and(eq(movies.isFilm, true), isNotNull(movies.hydratedAt), isNotNull(movies.title));
const chunks = <T>(rows: T[], size = 500): T[][] => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size));
const due = (now: Date) => or(isNull(movies.retryAfter), lte(movies.retryAfter, now));

@injectable()
export class DrizzleMoviesRepository implements IMoviesRepository {
  constructor(private readonly dbProvider: DbProvider) {}
  async ensureSourceAndSeeds() {
    return this.dbProvider.transaction(async () => {
      await this.dbProvider.client.insert(movieSourceState).values({ id: MOVIE_SOURCE_ID }).onConflictDoNothing();
      const inserted = await this.dbProvider.client.insert(movies).values(MOVIE_SEEDS.map((qid) => ({ wikidataId: qid, slug: `film-${qid.toLowerCase()}`, seedPriority: 100 }))).onConflictDoNothing({ target: movies.wikidataId }).returning({ id: movies.id });
      return { inserted: inserted.length, state: await this.sourceState() };
    });
  }
  async sourceState(): Promise<MovieSourceState> {
    const [state] = await this.dbProvider.client.select().from(movieSourceState).where(eq(movieSourceState.id, MOVIE_SOURCE_ID));
    if (!state) throw new Error("Movie source state is not initialized");
    return state;
  }
  async saveSourceState(patch: Partial<MovieSourceState>) {
    await this.dbProvider.client.update(movieSourceState).set({ ...patch, updatedAt: new Date() }).where(eq(movieSourceState.id, MOVIE_SOURCE_ID));
  }
  async insertDiscovered(qids: string[]): Promise<number> {
    if (qids.some((qid) => !isQid(qid))) throw new Error("Invalid discovered movie identifier");
    let inserted = 0;
    for (const batch of chunks([...new Set(qids)])) {
      inserted += (await this.dbProvider.client.insert(movies).values(batch.map((qid) => ({ wikidataId: qid, slug: `film-${qid.toLowerCase()}` })))
        .onConflictDoNothing({ target: movies.wikidataId }).returning({ id: movies.id })).length;
    }
    return inserted;
  }
  hydrationCandidates(limit: number, now: Date) {
    return this.dbProvider.client.select({ id: movies.id, wikidataId: movies.wikidataId, sourceRevision: movies.sourceRevision }).from(movies)
      .where(and(isNull(movies.hydratedAt), due(now))).orderBy(desc(movies.seedPriority), asc(movies.failureCount), asc(movies.createdAt), asc(movies.id)).limit(Math.min(50, limit));
  }
  refreshCandidates(afterId: string | null, limit: number, before: Date, now: Date) {
    return this.dbProvider.client.select({ id: movies.id, wikidataId: movies.wikidataId, sourceRevision: movies.sourceRevision }).from(movies)
      .where(and(isNotNull(movies.hydratedAt), lt(movies.checkedAt, before), due(now), afterId ? gt(movies.id, afterId) : undefined))
      .orderBy(asc(movies.id)).limit(Math.min(50, limit));
  }
  async findLabels(qids: string[]) {
    const out: Record<string, { name: string | null; checkedAt: Date }> = {};
    for (const batch of chunks([...new Set(qids)])) {
      const rows = await this.dbProvider.client.select().from(movieEntityLabels).where(inArray(movieEntityLabels.wikidataId, batch));
      for (const row of rows) out[row.wikidataId] = { name: row.name, checkedAt: row.checkedAt };
    }
    return out;
  }
  async labelRefreshCandidates(limit: number, before: Date) {
    return (await this.dbProvider.client.select({ qid: movieEntityLabels.wikidataId }).from(movieEntityLabels)
      .where(lt(movieEntityLabels.checkedAt, before)).orderBy(asc(movieEntityLabels.checkedAt), asc(movieEntityLabels.wikidataId)).limit(Math.min(50, limit))).map((row) => row.qid);
  }
  async writeLabels(labels: EntityLabels, now: Date) {
    await this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      for (const batch of chunks(Object.entries(labels))) {
        if (!batch.length) continue;
        await db.insert(movieEntityLabels).values(batch.map(([wikidataId, name]) => ({ wikidataId, name, checkedAt: now }))).onConflictDoUpdate({ target: movieEntityLabels.wikidataId,
          set: { name: sql`coalesce(excluded.name, ${movieEntityLabels.name})`, checkedAt: now } });
        for (const table of [moviePeople, movieCompanies, movieGenres]) {
          const values = sql.join(batch.map(([qid, name]) => sql`(${qid}::text, ${name}::text)`), sql`, `);
          await db.execute(sql`update ${table} set name=coalesce(v.name,${table.name}), label_checked_at=${now.toISOString()}::timestamptz from (values ${values}) v(qid,name) where ${table.wikidataId}=v.qid`);
        }
      }
    });
  }
  async markEntityFailure(qid: string, code: string, now: Date) {
    await this.dbProvider.client.update(movies).set({ checkedAt: now, errorCode: code.slice(0, 80), failureCount: sql`${movies.failureCount}+1`,
      retryAfter: new Date(now.getTime() + 24 * 60 * 60_000), updatedAt: now }).where(eq(movies.wikidataId, qid));
  }
  async persistMovie(movie: NormalizedMovie, now: Date): Promise<"updated" | "unchanged" | "imdb_conflict"> {
    return this.dbProvider.transaction(async () => {
      const db = this.dbProvider.client;
      const [existing] = await db.select().from(movies).where(eq(movies.wikidataId, movie.wikidataId)).for("update");
      if (!existing) throw new Error("Movie stub is missing");
      if (movieSnapshotDisposition(movie.sourceRevision, existing.sourceRevision, existing.hydratedAt !== null, existing.imdbConflict) === "unchanged") {
        await db.update(movies).set({ checkedAt: now, failureCount: 0, retryAfter: null, errorCode: null }).where(eq(movies.id, existing.id));
        return "unchanged";
      }
      let imdbId = movie.imdbConflict ? existing.imdbId : movie.imdbId;
      let imdbConflict = movie.imdbConflict;
      if (imdbId) {
        await db.execute(sql`select pg_advisory_xact_lock(hashtext(${'movie-imdb:' + imdbId}))`);
        const [owner] = await db.select({ id: movies.id }).from(movies).where(and(eq(movies.imdbId, imdbId), ne(movies.id, existing.id)));
        if (owner) { imdbId = existing.imdbId; imdbConflict = true; }
      }
      const references = [...new Set([...movie.companyQids, ...movie.genreQids, ...movie.credits.flatMap((credit) => [credit.personQid, ...credit.characterQids])])];
      const labels = await this.findLabels(references);
      for (const batch of chunks(references)) await db.insert(movieEntityLabels).values(batch.map((wikidataId) => ({ wikidataId, checkedAt: new Date(0) }))).onConflictDoNothing();
      const personQids = [...new Set(movie.credits.map((credit) => credit.personQid))];
      for (const batch of chunks(personQids)) await db.insert(moviePeople).values(batch.map((wikidataId) => ({ wikidataId, name: labels[wikidataId]?.name ?? null }))).onConflictDoNothing();
      for (const batch of chunks(movie.companyQids)) await db.insert(movieCompanies).values(batch.map((wikidataId) => ({ wikidataId, name: labels[wikidataId]?.name ?? null }))).onConflictDoNothing();
      for (const batch of chunks(movie.genreQids)) await db.insert(movieGenres).values(batch.map((wikidataId) => ({ wikidataId, slug: `genre-${wikidataId.toLowerCase()}`, name: labels[wikidataId]?.name ?? null }))).onConflictDoNothing();
      const people = personQids.length ? await db.select().from(moviePeople).where(inArray(moviePeople.wikidataId, personQids)) : [];
      const companies = movie.companyQids.length ? await db.select().from(movieCompanies).where(inArray(movieCompanies.wikidataId, movie.companyQids)) : [];
      const genres = movie.genreQids.length ? await db.select().from(movieGenres).where(inArray(movieGenres.wikidataId, movie.genreQids)) : [];
      const peopleByQid = new Map(people.map((person) => [person.wikidataId, person.id]));
      await db.update(movies).set({ title: movie.title, originalTitle: movie.originalTitle, description: movie.description,
        slug: existing.hydratedAt ? existing.slug : movieSlug(movie.title, movie.wikidataId), imdbId, imdbConflict,
        releaseDate: movie.releaseDate, releaseYear: movie.releaseYear, releasePrecision: movie.releasePrecision, runtimeMinutes: movie.runtimeMinutes,
        isFilm: movie.isFilm, sourceRevision: movie.sourceRevision ?? existing.sourceRevision, sourceModifiedAt: movie.sourceModifiedAt ?? existing.sourceModifiedAt,
        hydratedAt: now, checkedAt: now, failureCount: 0, retryAfter: null, errorCode: null, updatedAt: now }).where(eq(movies.id, existing.id));
      await db.delete(movieCredits).where(eq(movieCredits.movieId, existing.id));
      await db.delete(movieCompanyLinks).where(eq(movieCompanyLinks.movieId, existing.id));
      await db.delete(movieGenreLinks).where(eq(movieGenreLinks.movieId, existing.id));
      for (const batch of chunks(movie.credits)) await db.insert(movieCredits).values(batch.map((credit) => ({ movieId: existing.id, personId: peopleByQid.get(credit.personQid)!,
        statementId: credit.statementId, roleProperty: credit.roleProperty, rank: credit.rank, qualifiers: credit.qualifiers, characterNames: credit.characterNames })));
      if (companies.length) await db.insert(movieCompanyLinks).values(companies.map((company) => ({ movieId: existing.id, companyId: company.id })));
      if (genres.length) await db.insert(movieGenreLinks).values(genres.map((genre) => ({ movieId: existing.id, genreId: genre.id })));
      return imdbConflict ? "imdb_conflict" : "updated";
    });
  }
  async hasPendingWork(now: Date) {
    const pending = await this.dbProvider.client.select({ id: movies.id }).from(movies).where(and(isNull(movies.hydratedAt), due(now))).limit(1);
    if (pending.length) return true;
    return (await this.labelRefreshCandidates(1, new Date(now.getTime() - 7 * 24 * 60 * 60_000))).length > 0;
  }
  async listPublic(filter: { page: number; limit: number; q?: string }) {
    const tokens = filter.q?.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) ?? [];
    if (filter.q && !tokens.length) return { items: [], total: 0 };
    const where = and(publicMovie(), tokens.length ? sql`to_tsvector('simple',coalesce(${movies.title},'')) @@ to_tsquery('simple',${tokens.map((token) => token + ':*').join(' & ')})` : undefined);
    const [rows, total] = await Promise.all([
      this.dbProvider.client.select({ slug: movies.slug, title: movies.title, releaseDate: movies.releaseDate, releaseYear: movies.releaseYear, runtimeMinutes: movies.runtimeMinutes }).from(movies)
        .where(where).orderBy(asc(movies.title), asc(movies.id)).limit(filter.limit).offset((filter.page - 1) * filter.limit),
      this.dbProvider.client.select({ count: sql<number>`count(*)` }).from(movies).where(where),
    ]);
    return { items: rows.map((row) => ({ ...row, title: row.title!, posterImageUrl: null })), total: Number(total[0]?.count ?? 0) };
  }
  async findPublicBySlug(slug: string) {
    const db = this.dbProvider.client;
    const [movie] = await db.select().from(movies).where(and(eq(movies.slug, slug), publicMovie()));
    if (!movie) return null;
    const [credits, companies, genres] = await Promise.all([
      db.select({ statementId: movieCredits.statementId, roleProperty: movieCredits.roleProperty, wikidataId: moviePeople.wikidataId, name: moviePeople.name,
        characterNames: movieCredits.characterNames, qualifiers: movieCredits.qualifiers, rank: movieCredits.rank }).from(movieCredits).innerJoin(moviePeople, eq(moviePeople.id, movieCredits.personId))
        .where(and(eq(movieCredits.movieId, movie.id), ne(movieCredits.rank, "deprecated"))).orderBy(asc(movieCredits.roleProperty), asc(moviePeople.name), asc(movieCredits.statementId)),
      db.select({ wikidataId: movieCompanies.wikidataId, name: movieCompanies.name }).from(movieCompanyLinks).innerJoin(movieCompanies, eq(movieCompanies.id, movieCompanyLinks.companyId))
        .where(eq(movieCompanyLinks.movieId, movie.id)).orderBy(asc(movieCompanies.name)),
      db.select({ name: movieGenres.name, slug: movieGenres.slug }).from(movieGenreLinks).innerJoin(movieGenres, eq(movieGenres.id, movieGenreLinks.genreId))
        .where(and(eq(movieGenreLinks.movieId, movie.id), isNotNull(movieGenres.name))).orderBy(asc(movieGenres.name)),
    ]);
    const characterLabels = await this.findLabels([...new Set(credits.flatMap((credit) => characterQidsFromQualifiers(credit.qualifiers)))]);
    return { slug: movie.slug, title: movie.title!, releaseDate: movie.releaseDate, releaseYear: movie.releaseYear, runtimeMinutes: movie.runtimeMinutes,
      posterImageUrl: null, wikidataId: movie.wikidataId, imdbId: movie.imdbConflict ? null : movie.imdbId, description: movie.description, originalTitle: movie.originalTitle,
      sourceUpdatedAt: movie.sourceModifiedAt?.toISOString() ?? null, genres: genres.map((genre) => ({ ...genre, name: genre.name! })), companies,
      credits: credits.map((credit) => ({ statementId: credit.statementId, role: ({ P161: "cast", P57: "director", P162: "producer" } as const)[credit.roleProperty as "P161" | "P57" | "P162"],
        wikidataId: credit.wikidataId, name: credit.name, characterNames: [...new Set([...credit.characterNames,
          ...characterQidsFromQualifiers(credit.qualifiers).map((qid) => characterLabels[qid]?.name).filter((name): name is string => !!name)])], rank: credit.rank as "normal" | "preferred" | "deprecated" })) };
  }
}
