# Work state

Living handoff file so work can continue in a new session. Update it whenever a step finishes.
Last updated: 2026-11-04.

Specs: [docs/jobs-worker.md](docs/jobs-worker.md) (background jobs, authoritative), [AGENTS.md](AGENTS.md).

## 1. Library (`/games`, `/movies`, `/profile`) — DONE (not committed)

Standalone sub-brand "Vefa Library" (rename back to `vefa/library` in `apps/web/src/lib/librarySeo.ts` if wanted). Never links back to vefacaglar.com; own share previews (no "senior software engineer" text).

- Shell: `apps/web/src/components/library/` (LibraryShell with header tabs Games/Movies, account link or sign in, sign out; footer with language switcher; LibraryMasthead; OG image; fonts). Main site `Header.tsx` hides itself on `/games`, `/movies`, `/profile`.
- Look: neutral graphite palette scoped to library pages in `globals.css` (accent `#8aa4c8`), Geist only, no italics, sentence case (main site stays lowercase).
- Games: popularity sorting (see 3), game page blurred cover backdrop restored.
- Movies: "coming soon" skeleton only (real movies feature deferred to a later phase).
- Profiles: `/profile` → own profile, `/profile/settings` (public/private toggle), `/profile/[username]` overview (stats, recent activity, platforms), `/profile/[username]/games` (status tabs All/Playing/Completed/Backlog/On hold/Abandoned, sort Last activity/Playtime/Completion date, grid|list view with expandable rows + owner "Edit log"), `/profile/[username]/movies` (coming soon). Private profile: 401 → sign-in prompt, 403 → "this profile is private".
- Logout: `apps/web/src/lib/logout.ts`, `components/library/actions.ts`.

Open questions for the user (unanswered):
- Ratings: list view shows `9/10`, grid shows `90` — unify?
- Label "Critics" vs "Global" for critic score.
- Visitors see the owner's display name instead of "You" — ok?
- Platform chart follows the selected status tab — ok?

Not verified in a browser: signed-in pages (settings, log edit, private profile, expanded list row, signed-in header).

## 2. API / DB for library — DONE

- `users.is_profile_public` (default false). `GET /api/auth/me` returns username + isProfilePublic. `PUT /api/auth/profile/visibility`.
- `GET /api/games/users/:username/library` (public, tryAuth; 404/401/403). Library items include completedAt, lastActivityAt, platformName, criticScore, addedAt, latestLogId (owner only); summary.platforms.
- Playtime audit: table `user_game_playtime_entries` (only increases recorded, backfilled).
- Reserved username: `settings`.
- Migrations: `0019_broad_wendell_rand`, `0020_sad_spirit`, `0021_playtime-entries`.

## 3. Popularity + search — DONE (needs data run)

- IGDB popularity (Want to Play, Played, Steam reviews, IGDB rating count) → `games.popularity_score`; browse sorted by popularity. `POST /api/catalog/popularity/refresh` (admin) + `pnpm --filter api catalog:popularity`. IGDB type ids not verified live.
- Typesense is English-only (`*_en` collections, alias-aware bootstrap `ensureCollections()` in `src/server.ts`).
- Old TS `search:reindex` script removed — reindexing is now a worker job (see 4).
- Not decided: daily popularity refresh in `.github/workflows/catalog-import.yml` (could become a registered worker job instead).

## 4. Background jobs (Hangfire-style, Rust worker) — IN PROGRESS

Goal: never reindex from a PC. Dashboard → API enqueues → worker runs → live progress in dashboard.

Done:
- DB: `packages/db/src/schema/jobs.ts` (`jobs`, `job_logs`, `recurring_jobs`, `workers`), migration `0022_giant_sprite`.
- API: `apps/api/src/modules/jobs` — admin endpoints under `/api/jobs/dashboard` (list, enqueue, detail, cancel, retry/resume, recurring list/update/run, workers).
- Web: `/dashboard/jobs` + `/dashboard/jobs/[id]` (polling live view, retry vs resume, worker status). Strings in `lib/dashboard-strings.ts`.

In progress (background agents, session IDs for follow-ups):
- `fix-6` DONE (cargo fmt/clippy -D warnings/test all pass: 43 tests; scheduler ignores null cron; worker seeds nothing; `deploy/worker/` compose+scripts+README, `.github/workflows/worker-ci.yml`; not yet run against real DB/Typesense). Not in `pnpm dev` on purpose (local .env = production; would race the VPS worker) — run `pnpm --filter worker worker:dev`. Original scope — `apps/worker` Rust crate (claim/heartbeat/checkpoint/cancel/retry, scheduler), Dockerfile, `deploy/worker/`, `.github/workflows/worker-ci.yml`, parity fixtures; plus `pg_notify('job_events', id)` on every progress/log/status change; two handlers (below); scheduler skips null cron.
- `fix-7` DONE (root typecheck incl. worker ok, api 439 tests pass; migration `0023_magical_storm.sql` moves `search.reindex.daily` history to `search.reindex`, seeds `search.reindex` + `search.sync`; docs/jobs-worker.md + AGENTS.md updated; supports `status=processing` + `recurringJobId`). DONE (api typecheck ok, 105 files / 465 tests, deploy/api unittest ok): browser→API direct SSE (Vercel Hobby can't hold streams). New env `JOB_STREAM_TOKEN_SECRET` (unset → random per process + warning; must be shared if >1 API instance) and `WEB_ORIGINS` (stream CORS only; other routes still `WEB_URL`), both wired into deploy/api env example, prepare-deploy.py and api-ci.yml secrets; `?token=` redacted in request logs. fix-7: `POST /api/jobs/dashboard/:id/stream-token` → `{token (JWT 120s, job-scoped), expiresAt, streamPath}`, stream accepts `?token=`, CORS only on stream route (`WEB_ORIGINS`). des-4 DONE (web typecheck ok): `createJobStreamAction` in `jobs/actions.ts` (URL from `NEXT_PUBLIC_API_URL` → fallback `API_URL`; on Vercel set `NEXT_PUBLIC_API_URL=https://api2.vefacaglar.com`), hook reconnects with fresh token + `afterLogId` (backoff 1→10s), polling fallback; `[id]/stream/route.ts` deleted. Web change must ship together with/after the API token endpoint (404 = "ended"). Vercel preview origins not in CORS allowlist → polling fallback. Original scope — API SSE `GET /api/jobs/dashboard/:id/stream` (events `snapshot`, `log` with id, `done`, ping; `Last-Event-ID`; one `LISTEN job_events` connection + 2s safety recheck); registered jobs without cron (`recurring_jobs.cron` nullable, new migration, seeds), `search.sync` type, shared concurrency key `search.index`, recurring list gets `description`/`currentJob`/`lastJob`, jobs list `recurringJobId` filter; docs.
- `des-4` DONE (web typecheck ok, untested against real API/browser) — `components/JobProgress.tsx` (native `<progress>`), SSE via `[id]/stream/route.ts` + `hooks/useJobStream.ts` (polling fallback on HTTP error or 3 errors), `[id]/LogConsole.tsx` (auto-follow, jump to latest, cap 2000), `ConnectionIndicator`, `StatusBadge`; tabs `?tab=jobs` (processing/succeeded/failed/cancelled/all + `?recurringJobId=`) and `?tab=registered` (`RegisteredJobs.tsx`). Removed ReindexForm, RecurringJobs, cron UI. Open: "run now" disabled while a registered job is switched off (confirm with user); `processing` status + `recurringJobId` filter need fix-7's API (page merges running+queued until then).
- Docs: README.md rewritten for library/worker/jobs; new `docs/architecture.md`. Re-check both (and `docs/jobs-worker.md`, still describing old cron/drop design) once fix-6/fix-7 finish. README references `pnpm --filter worker worker:dev|typecheck|test|lint` — confirm `apps/worker/package.json` exists.

Target job design (user decision):
- Registered jobs have no cron (manual only): `search.reindex` and `search.sync`. They never run at the same time.
- `search.reindex` (full): new physical collections `{alias}__{yyyymmddhhmmss}` for all collections → load everything → swap all aliases only after every collection is fully loaded → delete old physical collections. Resume continues into the same physical collections; cancel deletes the half-built ones.
- `search.sync` (fill missing): per live collection, diff Typesense ids vs Postgres ids, upsert only missing documents; orphans only logged.

## Next steps

1. fix-6 / fix-7 / des-4 / fix-8 DONE. Root `pnpm typecheck` (4/4) and `pnpm test` pass: web 23 files / 236 tests (Vitest, characterization), api 105 / 465, worker 43. Web specs found suspected bugs (asserted as-is with `// NOTE:`), awaiting user decision: `safeReturnPath` accepts `/\evil.com` and `/\t/evil.com` (open redirect → use `safeInternalPath`); `localizeHref` split(sep,2) truncates extra `#`/`?`; `sanitizeReturnTo` doesn't block `/dashboard#x`, `/Dashboard`; `apiAction` revalidates before invalid-JSON error; `seo.ts` strips only one trailing slash; `slugify` drops non-Turkish accents (Pokémon→pokmon); middleware `startsWith` matches `/apiary`, `/dashboards`; jobs `format.ts` "60 seconds ago" rounding; `parseDateKey` years <100 → null. (cron UI was removed, so no cronError to test.)
   - Set GitHub secrets `JOB_STREAM_TOKEN_SECRET` (random 32+ bytes) and `WEB_ORIGINS`; Vercel env `NEXT_PUBLIC_API_URL=https://api2.vefacaglar.com`. Deploy API before (or with) web.
2. User runs locally (note: local `.env` points to PRODUCTION Postgres/Typesense):
   1. `pnpm --filter @vefacaglar/db db:migrate`
   2. `pnpm --filter worker worker:dev`
   3. `pnpm dev`, open `/dashboard/jobs` → Registered jobs → run `search.reindex`, watch live logs.
   4. `pnpm --filter api catalog:import --all --restart` then `pnpm --filter api catalog:popularity` if popularity data is still empty.
3. Deploy worker: GitHub secrets/vars (`WORKER_DEPLOY_ENABLED`, environment `worker-production`, VPS secrets), see `deploy/worker/README.md`.
4. Browser-check signed-in library pages; answer the open questions in section 1.
5. Commit in logical chunks (English messages): library UI, profile + API, popularity, typesense en-only, jobs (db/api/web), worker + CI.
6. Later: movies feature, popularity as a registered job.
7. Application logs (commit 3addda7, by Codex; see docs/application-logs.md): API + worker export selected events to Typesense `application_logs_v1` when `LOG_TYPESENSE_URL` + `LOG_TYPESENSE_API_KEY` are set (put them inside `API_ENV` / `WORKER_ENV` secrets). Reviewed: typecheck, api 466 tests, worker fmt/clippy/test pass. Open: no retention/cleanup for the log collection; expected 401/403 (private profiles, stream-token reconnect) are exported as warnings (noise); no unit tests for the log sink.
