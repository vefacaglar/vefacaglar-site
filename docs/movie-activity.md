# Movie watches and ratings

Movie activity uses the existing account/session authentication. PostgreSQL owns all personal activity; nothing is added to Typesense, catalog popularity, or provider synchronization.

`user_movie_watches` records separate watches with an optional calendar date. Rewatching a film, including twice on the same day or without a known date, creates separate UUID entries. `watched_on` is nullable and has no default; missing dates stay unknown instead of becoming the date the record was created. A known date can be backdated, edited, or cleared. Each watch may have a comment up to 2,000 characters, private by default and shareable by explicit choice; surrounding whitespace is trimmed and empty comments are stored as null. Each user/film has at most one independent current rating in `user_movie_ratings`, enforced by its composite primary key. Its database check permits only integers from 1 to 10. Clearing a rating deletes that row. Changes to watches never change the rating, and rating changes never create or delete watches.

## API

All activity endpoints require `app.requireAuth` and derive the owner from the session:

- `GET /api/movies/:slug/activity?page=1&limit=20`: one nullable rating and paginated watch history, ordered by `created_at DESC, id DESC` (maximum page size 50).
- `POST /api/movies/:slug/watches`: `{ id: UUID, watchedOn?: "YYYY-MM-DD" | null, comment?: string | null, isPublic?: boolean }`, returning the watch with 201. An omitted or null date is stored as null.
- `PUT /api/movies/:slug/watches/:id`: `{ watchedOn?: "YYYY-MM-DD" | null, comment?: string | null, isPublic?: boolean }`. Omitted fields preserve their stored values; explicit null clears the date or comment.
- `DELETE /api/movies/:slug/watches/:id`: 204.
- `PUT /api/movies/:slug/rating`: `{ rating: 1..10 | null }`.

A client generates a UUID once for each intended watch addition and retains it while retrying. An identical owned UUID/movie/nullable-date/normalized-comment/sharing retry returns the original watch. A conflicting owner, film, date, comment, or sharing choice returns 409 without exposing the existing record. Omitted and explicit-null create dates normalize to the same retry intent. Deliberately logging another watch uses a new UUID. This also protects against the shared HTTP client's network retries. Updates and deletes include owner, film, and watch predicates in the database query. Non-null calendar dates are validated beyond their string format, including leap days; invalid nonempty date strings are rejected. The web normalizes its blank field to null.

New or changed watch dates must be today or earlier according to `Europe/Istanbul`, independently of the server's timezone. Today's entire calendar date is accepted. An owned watch's unchanged legacy future date may be resubmitted while editing other fields; the API leaves that date out of the update patch rather than writing it over a concurrent date clear. Clearing a legacy date is allowed. Game log start/completion dates follow the same calendar-day policy and retain their existing optional/replacement semantics and start-before-completion rule. Release and project dates are unrelated to this restriction.

`GET /api/movies/users/:username/library` uses optional authentication and follows the Games profile visibility rules: missing/inactive account 404; private anonymous viewer 401; private other signed-in viewer 403; owner always visible. It returns an explicit identity/card/watch-date projection, one movie row with its current rating, and separate unique watched-film and total-watch counts. Dated and undated watches both contribute to those counts. Watch entries are newest-recorded first. `lastWatchedOn` and movie ordering use the maximum known watch date, independently of entry order; an all-undated history has a null latest date. Rating-only films are included. Watch IDs are included only for the owner. The profile projection excludes comments for every viewer, including its owner; explicitly shared entries have their own [community endpoint](community-ratings.md). A public movie becoming ineligible is omitted from both catalog and profile reads without deleting personal history.

`GET /api/movies/dashboard/stats` is admin-only. Its count comes from PostgreSQL's public film predicate (`is_film`, hydrated, non-null title), excluding discovery stubs. The main public film list retains pagination metadata but does not display a global catalog count.

## Web

Movie details have an adjacent 1–10 radio scale and a repeatable watch history. Logging or editing a watch opens a native modal with an optional date and comment. Escape, cancellation, focus return, pending controls, and in-modal errors preserve the form flow. An uncertain create freezes its UUID and submitted fields until the same save is confirmed, including when the modal is closed and reopened; a null date remains null throughout retries. Deletion keeps its confirmation dialog. A new watch starts with a blank date. Undated entries show “Date not specified” without using record creation or publication times as substitute watch dates. The profile Movies tab lists films with ratings and watch history; owner links return to the film's activity controls. Successful mutations revalidate the movie and owner's profile paths.

Migration 0034 creates the two activity tables, foreign keys with cascade deletion, history indexes, and the rating range check. Apply it before deploying API/web code that reads these tables. Migration 0035 adds the nullable comment and its 2,000-character database check; apply it before deploying comment reads/writes.

Migration 0038 makes the watch date nullable and preserves all existing dates. Release null-safe web readers before the migration/API rollout, then release forms that submit blank dates only after the API supports null. No undated production fixture is needed for verification.
