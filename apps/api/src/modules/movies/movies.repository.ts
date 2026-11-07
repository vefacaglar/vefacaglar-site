import { dirtyMovieSearch } from "./search/movie-search-state.repository";
import { injectable } from "tsyringe";
import { and, asc, desc, eq, exists, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { movies, moviePeople, movieCompanies, movieGenres, movieEntityLabels, movieCredits, movieCompanyLinks, movieGenreLinks, movieSourceState, moviePopularityState } from "@vefacaglar/db";
import { DbProvider } from "../../db.provider";
import { MOVIE_POPULARITY_SOURCE_ID, type MovieRanking } from "./popularity/popularity.types";
import { sourceUrl, utcDay } from "./popularity/wikipedia-interest";
import type { MovieCard } from "./list/list.schema";
import type { IMoviesRepository, MovieSourceState, MoviePosterCandidate } from "./movies.repository.interface";
import type { MoviePoster } from "./artwork/commons-poster";
import type { MoviePersonRole } from "./people/detail/detail.schema";
import { posterInputsPatch, publicMoviePoster } from "./artwork/poster-source";
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
    const cooldown = patch.cooldownUntil;
    await this.dbProvider.client.update(movieSourceState).set({ ...patch,
      // An in-flight successful fact window cannot clear a newer cooldown from
      // the concurrent title-mapping job. Only an expired cooldown can be cleared.
      ...(cooldown === undefined ? {} : { cooldownUntil: cooldown === null
        ? sql`case when ${movieSourceState.cooldownUntil} <= clock_timestamp() then null else ${movieSourceState.cooldownUntil} end`
        : sql`greatest(coalesce(${movieSourceState.cooldownUntil}, ${cooldown.toISOString()}::timestamptz), ${cooldown.toISOString()}::timestamptz)` }),
      updatedAt: new Date() }).where(eq(movieSourceState.id, MOVIE_SOURCE_ID));
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
      .where(and(isNull(movies.hydratedAt), due(now))).orderBy(
        sql`case when ${movies.wikipediaSourceDate} = (select source_date from ${moviePopularityState} where id=${MOVIE_POPULARITY_SOURCE_ID})
          and ${movies.wikipediaSourceDate} < ${utcDay(now)}::date
          and ${movies.wikipediaSourceDate} >= (${utcDay(now)}::date - 7)
          then ${movies.wikipediaViews} else null end desc nulls last`,
        desc(movies.seedPriority), asc(movies.failureCount), asc(movies.createdAt), asc(movies.id)).limit(Math.min(50, limit));
  }
  refreshCandidates(afterId: string | null, limit: number, before: Date, now: Date) {
    return this.dbProvider.client.select({ id: movies.id, wikidataId: movies.wikidataId, sourceRevision: movies.sourceRevision }).from(movies)
      .where(and(isNotNull(movies.hydratedAt), lt(movies.checkedAt, before), due(now), afterId ? gt(movies.id, afterId) : undefined))
      .orderBy(asc(movies.id)).limit(Math.min(50, limit));
  }
  posterInputsCandidates(limit: number, now: Date) {
    return this.dbProvider.client.select({ id: movies.id, wikidataId: movies.wikidataId, sourceRevision: movies.sourceRevision }).from(movies)
      .where(and(publicMovie(), isNull(movies.posterInputsCheckedAt), due(now)))
      .orderBy(desc(movies.seedPriority),
        sql`case when ${movies.wikipediaSourceDate} = (select source_date from ${moviePopularityState} where id=${MOVIE_POPULARITY_SOURCE_ID})
          and ${movies.wikipediaSourceDate} < ${utcDay(now)}::date and ${movies.wikipediaSourceDate} >= (${utcDay(now)}::date - 7)
          then ${movies.wikipediaViews} else null end desc nulls last`, asc(movies.title), asc(movies.id))
      .limit(Math.min(50, limit));
  }
  recognitionCandidates(limit: number, now: Date) {
    return this.dbProvider.client.select({ id: movies.id, wikidataId: movies.wikidataId, sourceRevision: movies.sourceRevision }).from(movies)
      .where(and(publicMovie(), isNull(movies.wikipediaLanguageCount), due(now)))
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
      const disposition = movieSnapshotDisposition(movie.sourceRevision, existing.sourceRevision, existing.hydratedAt !== null, existing.imdbConflict);
      const poster = posterInputsPatch(existing, { posterFileName: movie.posterFileName, enwikiArticle: movie.enwikiArticle, title: movie.title }, now,
        { preserveStoredTitle: disposition === "unchanged" });
      if (disposition === "unchanged") {
        const recognitionChanged = existing.wikipediaLanguageCount !== movie.wikipediaLanguageCount;
        await db.update(movies).set({ ...poster, wikipediaLanguageCount: movie.wikipediaLanguageCount,
          ...(recognitionChanged ? { updatedAt: now } : {}), checkedAt: now, failureCount: 0, retryAfter: null, errorCode: null }).where(eq(movies.id, existing.id));
        if (recognitionChanged || poster.posterCandidateVersion !== undefined || poster.posterImageUrl !== undefined) await dirtyMovieSearch(db, existing.id);
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
      await db.update(movies).set({ ...poster, title: movie.title, originalTitle: movie.originalTitle, description: movie.description,
        slug: existing.hydratedAt ? existing.slug : movieSlug(movie.title, movie.wikidataId), imdbId, imdbConflict,
        releaseDate: movie.releaseDate, releaseYear: movie.releaseYear, releasePrecision: movie.releasePrecision, runtimeMinutes: movie.runtimeMinutes,
        isFilm: movie.isFilm, wikipediaLanguageCount: movie.wikipediaLanguageCount,
        sourceRevision: movie.sourceRevision ?? existing.sourceRevision, sourceModifiedAt: movie.sourceModifiedAt ?? existing.sourceModifiedAt,
        hydratedAt: now, checkedAt: now, failureCount: 0, retryAfter: null, errorCode: null, updatedAt: now }).where(eq(movies.id, existing.id));
      await db.delete(movieCredits).where(eq(movieCredits.movieId, existing.id));
      await db.delete(movieCompanyLinks).where(eq(movieCompanyLinks.movieId, existing.id));
      await db.delete(movieGenreLinks).where(eq(movieGenreLinks.movieId, existing.id));
      for (const batch of chunks(movie.credits)) await db.insert(movieCredits).values(batch.map((credit) => ({ movieId: existing.id, personId: peopleByQid.get(credit.personQid)!,
        statementId: credit.statementId, roleProperty: credit.roleProperty, rank: credit.rank, qualifiers: credit.qualifiers, characterNames: credit.characterNames })));
      if (companies.length) await db.insert(movieCompanyLinks).values(companies.map((company) => ({ movieId: existing.id, companyId: company.id })));
      if (genres.length) await db.insert(movieGenreLinks).values(genres.map((genre) => ({ movieId: existing.id, genreId: genre.id })));
      await dirtyMovieSearch(db, existing.id);
      return imdbConflict ? "imdb_conflict" : "updated";
    });
  }
  posterCandidates(limit: number, now: Date, available = { commons: true, wikipedia: true }) {
    return this.dbProvider.client.select({ id: movies.id, wikidataId: movies.wikidataId, title: sql<string>`${movies.title}`, fileName: movies.posterFileName,
      enwikiArticle: movies.enwikiArticle, version: movies.posterCandidateVersion, hasImage: sql<boolean>`${movies.posterImageUrl} is not null`, resolvedFrom: movies.posterResolvedFrom }).from(movies)
      .where(and(publicMovie(), isNotNull(movies.posterInputsCheckedAt),
        or(available.commons ? isNotNull(movies.posterFileName) : sql`false`,
          available.wikipedia ? and(isNotNull(movies.enwikiArticle), or(isNull(movies.posterImageUrl),
            sql`coalesce(${movies.posterResolvedFrom},'commons') <> 'commons'`, isNull(movies.posterFileName))) : sql`false`),
        or(isNull(movies.posterRetryAfter), lte(movies.posterRetryAfter, now)),
        or(isNull(movies.posterCheckedAt), lt(movies.posterCheckedAt, new Date(now.getTime() - 7 * 86_400_000)))))
      .orderBy(desc(movies.seedPriority),
        sql`case when ${movies.wikipediaSourceDate} = (select source_date from ${moviePopularityState} where id=${MOVIE_POPULARITY_SOURCE_ID})
          and ${movies.wikipediaSourceDate} < ${utcDay(now)}::date and ${movies.wikipediaSourceDate} >= (${utcDay(now)}::date - 7)
          then ${movies.wikipediaViews} else null end desc nulls last`, asc(movies.title), asc(movies.id)).limit(Math.min(5, limit));
  }
  async persistPoster(candidate: MoviePosterCandidate, poster: MoviePoster | null, now: Date) {
    return this.dbProvider.transaction(async () => {
      const updated = await this.dbProvider.client.update(movies).set({ posterImageUrl: poster?.imageUrl ?? null, posterAttribution: poster?.attribution ?? null,
        posterResolvedFileName: poster ? poster.fileName ?? candidate.fileName : null, posterResolvedFrom: poster ? poster.origin ?? "commons" : null,
        posterCheckedAt: now, posterRetryAfter: new Date(now.getTime() + (poster ? 7 : 30) * 86_400_000),
        posterErrorCode: poster ? null : "poster_missing_or_unverified", updatedAt: now })
        .where(and(eq(movies.id, candidate.id), eq(movies.posterCandidateVersion, candidate.version))).returning({ id: movies.id });
      if (updated.length) await dirtyMovieSearch(this.dbProvider.client, candidate.id);
      return updated.length > 0;
    });
  }
  async markPosterFailure(candidates: MoviePosterCandidate[], retryAfter: Date) {
    for (const candidate of candidates) await this.dbProvider.client.update(movies)
      .set({ posterCheckedAt: null, posterRetryAfter: retryAfter, posterErrorCode: "artwork_temporarily_unavailable" })
      .where(and(eq(movies.id, candidate.id), eq(movies.posterCandidateVersion, candidate.version)));
  }
  async hasPendingWork(now: Date) {
    const pending = await this.dbProvider.client.select({ id: movies.id }).from(movies).where(and(isNull(movies.hydratedAt), due(now))).limit(1);
    if (pending.length) return true;
    return (await this.labelRefreshCandidates(1, new Date(now.getTime() - 7 * 24 * 60 * 60_000))).length > 0;
  }
  async listPublic(filter: { page: number; limit: number; q?: string }) {
    const { movieIds: _movieIds, ...result } = await this.listPublicMatching(filter);
    return result;
  }
  private async listPublicMatching(filter: { page: number; limit: number; q?: string }, extraFilter?: SQL) {
    const tokens = filter.q?.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) ?? [];
    const where = and(publicMovie(), extraFilter, filter.q && !tokens.length ? sql`false` : tokens.length ? sql`to_tsvector('simple',coalesce(${movies.title},'')) @@ to_tsquery('simple',${tokens.map((token) => token + ':*').join(' & ')})` : undefined)!;
    // One statement owns both the ranking descriptor and the page ordering. A
    // concurrent publication cannot expose date A with ordered observations B.
    const rows = await this.dbProvider.client.execute(sql`
      with source as (
        select (select source_date from ${moviePopularityState} where id=${MOVIE_POPULARITY_SOURCE_ID}) as source_date
      ), ranking as (
        select source_date, coalesce(source_date < (statement_timestamp() at time zone 'UTC')::date
          and source_date >= ((statement_timestamp() at time zone 'UTC')::date - 7), false) as is_fresh from source
      ), page as (
        select ${movies.id} as id, ${movies.slug} as slug, ${movies.title} as title,
          ${movies.posterImageUrl} as poster_image_url, ${movies.posterAttribution} as poster_attribution,
          ${movies.enwikiArticle} as poster_article, ${movies.posterResolvedFrom} as poster_origin,
          ${movies.releaseDate} as release_date, ${movies.releaseYear} as release_year, ${movies.runtimeMinutes} as runtime_minutes,
          case when (select is_fresh from ranking) and ${movies.wikipediaSourceDate} = (select source_date from ranking)
            then ${movies.wikipediaViews} else null end as interest
        from ${movies} where ${where}
        order by interest desc nulls last, ${movies.title}, ${movies.id}
        limit ${filter.limit} offset ${(filter.page - 1) * filter.limit}
      )
      select coalesce((select jsonb_agg(jsonb_build_object('movieId',id,'slug',slug,'title',title,'releaseDate',release_date,
          'releaseYear',release_year,'runtimeMinutes',runtime_minutes,'posterImageUrl',poster_image_url,'posterAttribution',poster_attribution,
          'posterArticle',poster_article,'posterOrigin',poster_origin)
          order by interest desc nulls last,title,id) from page),'[]'::jsonb) as items,
        (select count(*) from ${movies} where ${where}) as total,
        (select to_char(source_date,'YYYY-MM-DD') from ranking) as source_date,
        (select is_fresh from ranking) as is_fresh
    `);
    const row = rows[0] as unknown as { items: (MovieCard & { movieId: string; posterArticle: string | null; posterOrigin: string | null })[]; total: string | number; source_date: string | null; is_fresh: boolean };
    const ranking: MovieRanking = { mode: row.is_fresh ? "wikipedia_interest" : "alphabetical", sourceDate: row.source_date,
      sourceUrl: row.source_date ? sourceUrl(row.source_date) : null, isFresh: row.is_fresh };
    const items = row.items.map(({ movieId: _movieId, posterArticle, posterOrigin, ...card }) => ({ ...card,
      ...publicMoviePoster({ ...card, enwikiArticle: posterArticle, posterResolvedFrom: posterOrigin }) }));
    return { items, movieIds: row.items.map((item) => item.movieId), total: Number(row.total), ranking };
  }
  async findPublicPerson(wikidataId: string, filter: { page: number; limit: number }) {
    const db = this.dbProvider.client;
    const [person] = await db.select({ id: moviePeople.id, wikidataId: moviePeople.wikidataId, name: moviePeople.name })
      .from(moviePeople).where(eq(moviePeople.wikidataId, wikidataId));
    if (!person) return null;
    const linkedCredit = exists(db.select({ value: sql`1` }).from(movieCredits).where(and(
      eq(movieCredits.movieId, movies.id), eq(movieCredits.personId, person.id), ne(movieCredits.rank, "deprecated"),
    )));
    const { items, movieIds, total, ranking } = await this.listPublicMatching(filter, linkedCredit);
    return { person: { wikidataId: person.wikidataId, name: person.name }, total, ranking,
      items: await this.personFilms(person.id, movieIds, items) };
  }
  async findPublicPersonHeader(wikidataId: string) {
    const [person] = await this.dbProvider.client.select({ id: moviePeople.id, wikidataId: moviePeople.wikidataId, name: moviePeople.name })
      .from(moviePeople).where(eq(moviePeople.wikidataId, wikidataId));
    return person ?? null;
  }
  async hydratePublicIds(ids: string[], personId?: string) {
    if (!ids.length) return [];
    const db = this.dbProvider.client;
    const linkedCredit = personId ? exists(db.select({ value: sql`1` }).from(movieCredits).where(and(
      eq(movieCredits.movieId, movies.id), eq(movieCredits.personId, personId), ne(movieCredits.rank, "deprecated")))) : undefined;
    const rows = await db.select().from(movies).where(and(publicMovie(), inArray(movies.id, ids), linkedCredit));
    const byId = new Map(rows.map((row) => [row.id, row]));
    // Fail closed: the service falls back if a selected film is no longer public/linked.
    const selected = ids.flatMap((id) => { const row = byId.get(id); return row ? [row] : []; });
    const cards = selected.map((movie) => ({ slug: movie.slug, title: movie.title!, releaseDate: movie.releaseDate,
      releaseYear: movie.releaseYear, runtimeMinutes: movie.runtimeMinutes, ...publicMoviePoster(movie) }));
    return personId ? this.personFilms(personId, selected.map((row) => row.id), cards) : cards;
  }
  private async personFilms(personId: string, movieIds: string[], items: MovieCard[]) {
    const db = this.dbProvider.client;
    const credits = movieIds.length ? await db.select({ movieId: movieCredits.movieId, roleProperty: movieCredits.roleProperty })
      .from(movieCredits).where(and(eq(movieCredits.personId, personId), inArray(movieCredits.movieId, movieIds), ne(movieCredits.rank, "deprecated")))
      .groupBy(movieCredits.movieId, movieCredits.roleProperty) : [];
    const properties = { P161: "cast", P57: "director", P162: "producer" } as const;
    const roleOrder: MoviePersonRole[] = ["cast", "director", "producer"];
    const roles = new Map<string, Set<MoviePersonRole>>();
    for (const credit of credits) {
      const role = properties[credit.roleProperty as keyof typeof properties];
      if (!role) continue;
      const filmRoles = roles.get(credit.movieId) ?? new Set<MoviePersonRole>();
      filmRoles.add(role);
      roles.set(credit.movieId, filmRoles);
    }
    return items.map((item, index) => ({ ...item, roles: roleOrder.filter((role) => roles.get(movieIds[index])?.has(role)) }));
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
      ...publicMoviePoster(movie), wikidataId: movie.wikidataId, imdbId: movie.imdbConflict ? null : movie.imdbId, description: movie.description, originalTitle: movie.originalTitle,
      sourceUpdatedAt: movie.sourceModifiedAt?.toISOString() ?? null, genres: genres.map((genre) => ({ ...genre, name: genre.name! })), companies,
      credits: credits.map((credit) => ({ statementId: credit.statementId, role: ({ P161: "cast", P57: "director", P162: "producer" } as const)[credit.roleProperty as "P161" | "P57" | "P162"],
        wikidataId: credit.wikidataId, name: credit.name, characterNames: [...new Set([...credit.characterNames,
          ...characterQidsFromQualifiers(credit.qualifiers).map((qid) => characterLabels[qid]?.name).filter((name): name is string => !!name)])], rank: credit.rank as "normal" | "preferred" | "deprecated" })) };
  }
}
