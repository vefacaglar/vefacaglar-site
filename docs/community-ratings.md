# Community ratings and shared logs

Game and movie detail pages read community information from separate public endpoints:

- `GET /api/games/:slug/community?page=1&limit=10`
- `GET /api/movies/:slug/community?page=1&limit=10`

The maximum page size is 50. Responses contain a site-rating summary, explicitly shared entries and pagination. Unknown games and unavailable/unhydrated/non-film movies return 404. Empty and out-of-range pages retain the real rating summary and entry total.

## Privacy

A public entry requires an active author, a public profile and a non-null `shared_at` on that particular log/watch. The same active/public-profile condition governs rating contributions. Making a profile private or deactivating a user removes their entries and ratings from subsequent uncached reads.

Existing rows keep `shared_at = null`. Owner APIs expose the setting as `isPublic`; publishing preserves the first publication time with `COALESCE(shared_at, now())`, while unsharing clears it. A sharing choice may be stored while the profile is private; it becomes visible only when the profile is public. Owner forms explain this requirement and link to profile settings.

Game reviews use `user_games.review_text`, independently of the existing private `notes`. Movie reviews use each watch's `comment`. New text is trimmed, whitespace-only text becomes null, and requests are limited to 2,000 Unicode characters. A shared log may contain no review text. Public entries include only the author username/display name, publication date, review, rating and a small domain-specific activity projection. Emails, user UUIDs, private notes, purchases and playtime audit entries are excluded. Review text is plain text and must be escaped by renderers.

Existing private `/logs` and `/activity` APIs and public profile response projections retain their purposes. Personal activity is never placed in Typesense.

## Site average

Each eligible user contributes one rating per content item. Movies use the unique current user/movie rating, on the 1–10 scale. Games use the latest rated log for each user/game, ordered by `created_at DESC, id DESC`, on the 0–100 scale. Null, zero and out-of-range game ratings are ignored. Clearing a later game's rating therefore falls back to that user's next latest rated log, matching the existing library rule.

A review or shared log is not required to contribute a rating. A movie entry displays its author's current movie rating; a game entry displays that individual log's rating. Site averages are rounded to one decimal, and an unrated item returns `average: null, count: 0`. Provider critic scores remain separate from the site rating.

Entries are ordered by `shared_at DESC, id DESC`, giving stable pagination when publication times tie.

A movie entry's `watchedOn` can be null when its author did not specify a watch date. The publication timestamp remains independent and is never substituted as the watch date. Undated shared watches still contribute to entry counts and do not change rating eligibility or averages.

## Mutation compatibility and retry behavior

New owner body fields are optional. Omitting `reviewText` or `isPublic` on an existing game log preserves those stored fields; other existing game fields keep their established replacement behavior. Omitting `isPublic` on a watch update preserves sharing. Create requests default to private.

A movie watch's UUID replay must match the normalized user/movie/date/comment/sharing payload exactly. Changing the audience on a replay conflicts rather than silently publishing it. The web submission freezes the UUID and the entire payload across ambiguous network failures. Game quick logs default to private; review publication is available through the existing owned PUT editor.

## Deployment and validation

Apply the generated migration before deploying the backward-compatible API. Finish the API deployment before releasing forms that send the new fields, so an older API cannot discard them.

Handler tests use mocked dependencies. A disposable migrated PostgreSQL integration check additionally covers one-vote aggregation, tied log dates, explicit privacy projections, omitted-field compatibility, publication timestamps, UUID sharing conflicts, unsharing and profile visibility/deactivation. No real user history is required for browser verification.
