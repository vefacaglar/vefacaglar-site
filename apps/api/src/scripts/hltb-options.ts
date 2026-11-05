import type { HoursField } from "../modules/catalog/hltb/hltb.types";
export type HltbOptions = { game: string; query?: string; apply: boolean; hltbId?: number; overwriteFields: HoursField[]; replaceMapping: boolean; acknowledgeMismatch: boolean; refresh: boolean; retrySync: boolean };
export function parseHltbOptions(args: string[]): HltbOptions {
  const result: HltbOptions = { game: "", apply: false, overwriteFields: [], replaceMapping: false, acknowledgeMismatch: false, refresh: false, retrySync: false };
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error(`Duplicate option: ${flag}`);
    seen.add(flag);
    const value = () => { const next = args[++i]; if (!next || next.startsWith("--")) throw new Error(`Missing value for ${flag}`); return next; };
    switch (flag) {
      case "--game": result.game = value(); break;
      case "--query": result.query = value(); break;
      case "--apply": result.apply = true; break;
      case "--hltb-id": { const raw = value(); const id = Number(raw); if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) throw new Error("Invalid HLTB ID"); result.hltbId = id; break; }
      case "--overwrite": { const fields = value().split(","); if (fields.some((field) => !["mainHours", "mainExtraHours", "completionistHours"].includes(field)) || new Set(fields).size !== fields.length) throw new Error("Invalid overwrite fields"); result.overwriteFields = fields as HoursField[]; break; }
      case "--replace-mapping": result.replaceMapping = true; break;
      case "--acknowledge-mismatch": result.acknowledgeMismatch = true; break;
      case "--refresh": result.refresh = true; break;
      case "--retry-sync": result.retrySync = true; break;
      default: throw new Error(`Unknown option: ${flag}`);
    }
  }
  if (!result.game || result.game.length > 180) throw new Error("--game requires a game UUID or slug");
  if (result.apply && !result.hltbId) throw new Error("--apply requires --hltb-id");
  if (!result.apply && (result.hltbId || result.overwriteFields.length || result.replaceMapping || result.acknowledgeMismatch)) throw new Error("Mutation options require --apply");
  if (result.retrySync && (result.apply || result.query || result.refresh)) throw new Error("--retry-sync cannot be combined with lookup or apply options");
  return result;
}
