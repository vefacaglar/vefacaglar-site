import type { EnglishTitleOptions } from "./english-titles.handler";

export const ENGLISH_TITLE_USAGE = "usage: fix-movie-english-titles [--dry-run [--limit N] [--after <movie-uuid>]]";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** No flags = one bounded apply run (the worker job). Inspection flags require --dry-run. */
export function parseEnglishTitleArgs(argv: string[]): EnglishTitleOptions {
  const options: EnglishTitleOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--dry-run") options.dryRun = true;
    else if (flag === "--limit" && /^[1-9]\d{0,6}$/.test(argv[i + 1] ?? "")) options.limit = Number(argv[++i]);
    else if (flag === "--after" && UUID.test(argv[i + 1] ?? "")) options.after = argv[++i].toLowerCase();
    else throw new Error(ENGLISH_TITLE_USAGE);
  }
  if (!options.dryRun && (options.limit !== undefined || options.after !== undefined)) throw new Error(ENGLISH_TITLE_USAGE);
  return options;
}
