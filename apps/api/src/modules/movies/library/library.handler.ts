import { inject, injectable } from "tsyringe";
import type { FastifyRequest } from "fastify";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../../../shared/http-errors";
import { USERS_REPOSITORY } from "../../auth/auth.tokens";
import type { IUsersRepository } from "../../auth/users.repository.interface";
import { MOVIE_ACTIVITY_REPOSITORY } from "../activity/activity.tokens";
import type { IMovieActivityRepository } from "../activity/activity.repository.interface";
import type { MovieLibrary, MovieLibraryParams } from "./library.schema";
import { latestKnownWatchDate } from "../activity/activity.values";
@injectable()
export class GetMovieLibraryHandler {
  constructor(@inject(USERS_REPOSITORY) private readonly users: IUsersRepository,
    @inject(MOVIE_ACTIVITY_REPOSITORY) private readonly repo: IMovieActivityRepository) {}
  async handle(request: FastifyRequest<{ Params: MovieLibraryParams }>): Promise<MovieLibrary> {
    const user = await this.users.findByUsername(request.params.username);
    if (!user || !user.isActive) throw new NotFoundError("err_profile_not_found");
    const viewerId = request.user?.id, isOwner = viewerId === user.id;
    if (!user.isProfilePublic && !isOwner) throw viewerId ? new ForbiddenError("err_profile_private") : new UnauthorizedError("err_profile_private");
    const rows = await this.repo.listLibrary(user.id);
    const movies = rows.map(({ movie, rating, watches }) => ({
      slug: movie.slug, title: movie.title, releaseDate: movie.releaseDate, releaseYear: movie.releaseYear,
      runtimeMinutes: movie.runtimeMinutes, posterImageUrl: null, posterAttribution: null,
      rating, watchCount: watches.length,
      lastWatchedOn: latestKnownWatchDate(watches),
      watches: watches.map((watch) => ({ ...(isOwner ? { id: watch.id } : {}), watchedOn: watch.watchedOn })),
    }));
    const ratings = movies.flatMap((movie) => movie.rating === null ? [] : [movie.rating]);
    return { user: { username: user.username, displayName: user.displayName, isProfilePublic: user.isProfilePublic }, isOwner,
      summary: { filmCount: movies.length, watchedFilmCount: movies.filter((movie) => movie.watchCount > 0).length,
        watchCount: movies.reduce((sum, movie) => sum + movie.watchCount, 0), ratedFilmCount: ratings.length,
        averageRating: ratings.length ? Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length * 10) / 10 : null }, movies };
  }
}
