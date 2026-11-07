# Movie watches and ratings

Movie activity uses the existing account/session authentication. PostgreSQL owns all personal activity; nothing is added to Typesense, catalog popularity, or provider synchronization.

`user_movie_watches` records separate dated watches. Rewatching a film, including twice on the same day, creates separate UUID entries. `watched_on` is a calendar date, not a timestamp. A watch can be backdated, edited, or deleted. Each user/film has at most one independent current rating in `user_movie_ratings`, enforced by its composite primary key. Its database check permits only integers from 1 to 10. Clearing a rating deletes that row. Changes to watches never change the rating, and rating changes never create or delete watches.

## API

All activity endpoints require `app.requireAuth` and derive the owner from the session:

- `GET /api/movies/:slug/activity?page=1&limit=20`: one nullable rating and a dated, paginated watch history (maximum page size 50).
- `POST /api/movies/:slug/watches`: `{ id: UUID, watchedOn: "YYYY-MM-DD" }`, returning the watch with 201.
- `PUT /api/movies/:slug/watches/:id`: `{ watchedOn: "YYYY-MM-DD" }`.
- `DELETE /api/movies/:slug/watches/:id`: 204.
- `PUT /api/movies/:slug/rating`: `{ rating: 1..10 | null }`.

A client generates a UUID once for each intended watch addition and retains it while retrying. An identical owned UUID/movie/date retry returns the original watch. A conflicting owner, film, or date returns 409 without exposing the existing record. Deliberately logging another watch uses a new UUID. This also protects against the shared HTTP client's network retries. Updates and deletes include owner, film, and watch predicates in the database query. Calendar dates are validated beyond their string format, including leap days.

`GET /api/movies/users/:username/library` uses optional authentication and follows the Games profile visibility rules: missing/inactive account 404; private anonymous viewer 401; private other signed-in viewer 403; owner always visible. It returns an explicit identity/card/watch-date projection, one movie row with its current rating, and separate unique watched-film and total-watch counts. Rating-only films are included. Watch IDs are included only for the owner. A public movie becoming ineligible is omitted from both catalog and profile reads without deleting personal history.

`GET /api/movies/dashboard/stats` is admin-only. Its count comes from PostgreSQL's public film predicate (`is_film`, hydrated, non-null title), excluding discovery stubs. The main public film list retains pagination metadata but does not display a global catalog count.

## Web

Movie details have one rating selector and a repeatable watch history with inline date editing and deletion confirmation. The new-watch date defaults to the browser's current local calendar day. The profile Movies tab lists films with ratings and watch dates; owner links return to the film's activity controls. Successful mutations revalidate the movie and owner's profile paths.

Migration 0034 creates the two activity tables, foreign keys with cascade deletion, history indexes, and the rating range check. Apply it before deploying API/web code that reads these tables.
