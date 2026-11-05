# HowLongToBeat lookup

The dashboard game editor and the CLI use the same candidate lookup and explicit application service. This is a best-effort integration with HowLongToBeat's public website, not a supported developer API. Missing or blocked data is reported as unavailable; it is never fabricated.

Apply generated database migration `0029` after `0027` and `0028`, then deploy the API, web and worker together. It adds bounded per-game lookup receipts and one provider permit/cooldown row. `game_hltb_popularity` remains the only game-to-HLTB mapping. Its `mapping_source` distinguishes imported and manually confirmed bindings; `mapping_verified_at` is separate from engagement `updated_at`, which is null when a manual selection has not fetched counts.

## CLI

Use the usual database and Typesense configuration. No HLTB account or new API key is required. Run commands from the repository root:

```sh
pnpm --filter api catalog:hltb --game the-witcher-3-wild-hunt
pnpm --filter api catalog:hltb --game the-witcher-3-wild-hunt --query "The Witcher 3: Wild Hunt"
pnpm --filter api catalog:hltb --game the-witcher-3-wild-hunt --apply --hltb-id 10270
pnpm --filter api catalog:hltb --game the-witcher-3-wild-hunt --apply --hltb-id 10270 --overwrite mainHours,mainExtraHours
pnpm --filter api catalog:hltb --game the-witcher-3-wild-hunt --retry-sync
```

`--game` accepts a local game UUID or slug. Lookup is the default: it may cache a short-lived receipt but does not change the catalog mapping or completion times. JSON output includes candidate IDs, titles, years, source links, hours, identity warnings and retry status. An apply first obtains a receipt and rechecks the selected candidate against a fresh provider search. Never choose an ID without reviewing the lookup output.

Application requires both `--apply` and `--hltb-id`. It fills null durations by default. `--overwrite` names only the fields intentionally being replaced: `mainHours`, `mainExtraHours`, `completionistHours`. Missing provider values never clear saved values. Replacing an existing ID additionally requires `--replace-mapping`; a differing title or known release year requires `--acknowledge-mismatch`. An ID already bound to another local game is rejected.

Exit code 0 means the JSON operation completed, 1 indicates a rejected/failed operation, and 2 means provider data was unavailable or an apply could not proceed from its lookup outcome. A successful catalog save with `searchSync: "pending"` remains a successful save; retry with `--retry-sync`. Public session tokens and raw provider responses are never printed.

## Dashboard

Open a game under Dashboard → Games. The HowLongToBeat section beside the duration fields searches and lists candidates. Select an entry, review its title/year and source link, then apply it. Overwriting saved fields, remapping an existing entry, and accepting identity differences each need their own explicit choice. Unsaved duration edits must be saved or discarded first. Applying updates the actual form duration state, so a subsequent normal save cannot silently restore its original values.

The administrator-only API endpoints are `POST /api/catalog/games/:id/hltb/lookup`, `/apply`, and `/retry-sync`. Lookup accepts a bounded query and optional refresh flag. Apply accepts a server receipt ID, candidate ID, optimistic state version, selected overwrite fields and acknowledgements; it never accepts durations from the client. A changed game or expired/replaced receipt requires another lookup.

## Bounds and synchronization

Receipts cache at most 20 candidates for 15 minutes; misses cache for one hour. Provider failures use short backoff. Website requests share a persisted cross-process permit, at least 500 ms between starts, a 10-second request timeout and a 2 MiB response bound. Candidate searches have a 30-second overall deadline; the existing five-page popular scan has a 90-second deadline. Provider `Retry-After` is respected, including longer cooldowns. Refresh cannot bypass cooldowns. A blocked response fails fast; it does not trigger anti-bot workarounds. Rotated public endpoints are rediscovered after a stale endpoint fails and cooldown expires.

Mapping ownership, optimistic state checks, saved hours and pending search status commit together. Background popularity refreshes may supplement only an unbound game or its existing HLTB ID; a rejected candidate cannot contribute hours. Mapping locks are acquired in stable order before game rows. Strict incremental search updates serialize per game across lookup-tool processes, and clear pending status only for the matching saved version. A failed search update does not undo a committed catalog save. `synced` acknowledges that incremental delivery; it does not promise global index snapshot consistency with concurrent background imports or alias swaps. The retry endpoint and CLI path are idempotent. Public typed searches retain Typesense relevance and totals but hydrate their current card fields from PostgreSQL in one bounded page query. Completion times and scores on cards therefore remain current even if a concurrent index operation contains older display values. Dashboard game lists also hydrate their ranked records and relations from PostgreSQL in bounded batches. Deleted indexed hits are omitted; source search counts remain eventually consistent until indexing catches up.

No broad HLTB catalog import or automatic fuzzy matching is added. Existing coverage remains sparse until additional entries are explicitly looked up and confirmed, or matched by the existing bounded popular scan.
