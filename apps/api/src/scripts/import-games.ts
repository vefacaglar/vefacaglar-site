import "reflect-metadata";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { container } from "../container";
import { ImportGameHandler, type ImportOptions, type ImportResult, type ImportStatus } from "../modules/catalog/import/import.handler";
import { IGDB_CLIENT } from "../modules/catalog/import/import.tokens";
import type { IIgdbClient } from "../modules/catalog/import/import.types";

// Pause between HLTB lookups to keep its traffic polite; IGDB pages are
// throttled separately to stay under its 4 req/s limit.
const HLTB_DELAY_MS = 1500;
const IGDB_PAGE_DELAY_MS = 300;
// Crawl progress lives next to the package so an interrupted --all run resumes.
const STATE_FILE = path.resolve(__dirname, "../../.catalog-import-state.json");

const USAGE = `usage:
  pnpm --filter api catalog:import [options] "Game Title" ...
  pnpm --filter api catalog:import [options] --file titles.txt
  pnpm --filter api catalog:import [options] --all [--min-ratings N] [--max N] [--max-minutes N] [--restart]

options:
  --dry-run        report what would change, write nothing
  --skip-hltb      do not fetch completion times from HowLongToBeat
  --with-hltb      --all only: also fetch HLTB times (off by default; HLTB rate-limits scrapers)
  --all            crawl the whole IGDB catalog in id order (resumable)
  --min-ratings N  --all only: skip games with fewer than N IGDB ratings
  --max N          --all only: stop after N games
  --max-minutes N  --all only: stop cleanly after N minutes (for CI job time limits)
  --restart        --all only: ignore saved progress and start from the beginning`;

type Args = {
  titles: string[];
  all: boolean;
  restart: boolean;
  minRatings?: number;
  max?: number;
  maxMinutes?: number;
  options: ImportOptions;
};

function usage(): never {
  console.error(USAGE);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const args: Args = { titles: [], all: false, restart: false, options: {} };
  let withHltb = false;
  const numberArg = (value: string | undefined): number => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) usage();
    return n;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--dry-run": args.options.dryRun = true; break;
      case "--skip-hltb": args.options.skipHltb = true; break;
      case "--with-hltb": withHltb = true; break;
      case "--all": args.all = true; break;
      case "--restart": args.restart = true; break;
      case "--min-ratings": args.minRatings = numberArg(argv[++i]); break;
      case "--max": args.max = numberArg(argv[++i]); break;
      case "--max-minutes": args.maxMinutes = numberArg(argv[++i]); break;
      case "--file": {
        const file = argv[++i];
        if (!file) usage();
        const lines = fs.readFileSync(path.resolve(process.cwd(), file), "utf8").split(/\r?\n/);
        args.titles.push(...lines.map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
        break;
      }
      default:
        if (arg.startsWith("--")) usage();
        args.titles.push(arg);
    }
  }

  args.titles = [...new Set(args.titles)];
  if (args.all === (args.titles.length > 0)) usage();
  // A full crawl only uses IGDB, whose official API has no daily quota. HLTB is
  // scraped and throttles bulk traffic, so it is opt-in there.
  if (args.all && !withHltb) args.options.skipHltb = true;
  return args;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function logResult(result: ImportResult, counts: Record<ImportStatus, number>): void {
  counts[result.status]++;
  const target = result.slug ? ` -> ${result.title} (${result.slug})` : "";
  const notes = result.notes.length ? ` [${result.notes.join("; ")}]` : "";
  console.log(`[${result.status}] ${result.query}${target}${notes}`);
}

async function importTitles(handler: ImportGameHandler, args: Args, counts: Record<ImportStatus, number>) {
  for (const [index, query] of args.titles.entries()) {
    if (index > 0) await sleep(HLTB_DELAY_MS);
    logResult(await handler.handle(query, args.options), counts);
  }
}

function readState(): number {
  try {
    return (JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as { lastId: number }).lastId;
  } catch {
    return 0;
  }
}

async function crawlCatalog(handler: ImportGameHandler, args: Args, counts: Record<ImportStatus, number>) {
  const igdb = container.resolve<IIgdbClient>(IGDB_CLIENT);
  // Dry runs never persist progress, so they always start where the real crawl is.
  const persist = !args.options.dryRun;
  let afterId = args.restart ? 0 : readState();
  let processed = 0;
  const deadline = args.maxMinutes === undefined ? Infinity : Date.now() + args.maxMinutes * 60_000;
  const limitReached = () => (args.max !== undefined && processed >= args.max) || Date.now() >= deadline;
  console.log(`[catalog:import] crawling IGDB from id > ${afterId}`);

  while (!limitReached()) {
    const page = await igdb.listGames(afterId, { minRatings: args.minRatings });
    if (page.lastId === null) {
      console.log("[catalog:import] reached the end of the IGDB catalog");
      break;
    }

    for (const game of page.games) {
      if (limitReached()) break;
      logResult(await handler.importSource(game, args.options), counts);
      processed++;
      if (!args.options.skipHltb) await sleep(HLTB_DELAY_MS);
    }

    // Progress is saved per page; re-running a half-done page is safe because
    // already-imported games come back as "skipped".
    if (!limitReached()) {
      afterId = page.lastId;
      if (persist) fs.writeFileSync(STATE_FILE, JSON.stringify({ lastId: afterId }));
    }
    await sleep(IGDB_PAGE_DELAY_MS);
  }
  if (limitReached()) console.log(`[catalog:import] limit reached, will resume from id > ${afterId}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const handler = container.resolve(ImportGameHandler);
  const counts: Record<ImportStatus, number> = { created: 0, updated: 0, skipped: 0, not_found: 0, failed: 0 };

  console.log(
    `[catalog:import] mode=${args.all ? "all" : "titles"}, dryRun=${!!args.options.dryRun}, skipHltb=${!!args.options.skipHltb}`
  );
  if (args.all) await crawlCatalog(handler, args, counts);
  else await importTitles(handler, args, counts);

  console.log(`[catalog:import] done: ${JSON.stringify(counts)}`);
  process.exit(counts.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[catalog:import] failed:", err);
  process.exit(1);
});
