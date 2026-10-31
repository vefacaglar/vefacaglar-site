import "reflect-metadata";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

import { container } from "../container";
import { ImportGameHandler, type ImportStatus } from "../modules/catalog/import/import.handler";

// Pause between titles to stay well under IGDB's 4 req/s limit and to keep
// HLTB traffic polite.
const DELAY_MS = 1500;

function usage(): never {
  console.error(
    "usage: pnpm --filter api catalog:import [--dry-run] [--skip-hltb] [--file titles.txt] \"Game Title\" ..."
  );
  process.exit(1);
}

function readTitles(argv: string[]): string[] {
  const titles: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--file") {
      const file = argv[++i];
      if (!file) usage();
      const lines = fs.readFileSync(path.resolve(process.cwd(), file), "utf8").split(/\r?\n/);
      titles.push(...lines.map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
    } else if (!arg.startsWith("--")) {
      titles.push(arg);
    }
  }
  return [...new Set(titles)];
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const skipHltb = argv.includes("--skip-hltb");
  const titles = readTitles(argv);
  if (titles.length === 0) usage();

  const handler = container.resolve(ImportGameHandler);
  const counts: Record<ImportStatus, number> = { created: 0, updated: 0, skipped: 0, not_found: 0, failed: 0 };

  console.log(`[catalog:import] ${titles.length} title(s), dryRun=${dryRun}, skipHltb=${skipHltb}`);
  for (const [index, query] of titles.entries()) {
    if (index > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
    const result = await handler.handle(query, { dryRun, skipHltb });
    counts[result.status]++;
    const target = result.slug ? ` -> ${result.title} (${result.slug})` : "";
    const notes = result.notes.length ? ` [${result.notes.join("; ")}]` : "";
    console.log(`[${result.status}] ${query}${target}${notes}`);
  }

  console.log(`[catalog:import] done: ${JSON.stringify(counts)}`);
  process.exit(counts.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[catalog:import] failed:", err);
  process.exit(1);
});
