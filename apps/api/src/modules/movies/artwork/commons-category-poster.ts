import { attributionText, commonsFileName, normalizeCommonsPoster, type MoviePoster } from "./commons-poster";

/** Bounded member listing sizes for the film category and its poster subcategory. */
export const CATEGORY_MEMBER_LIMIT = 30;
export const POSTER_SUBCATEGORY_MEMBER_LIMIT = 20;
export type CommonsCategoryPosterResult = { poster: MoviePoster | null; posterSubcategory: string | null };

/** Wikidata P373 stores a Commons category name without the namespace prefix. */
export function commonsCategoryName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/_/g, " ").trim().normalize("NFC").replace(/^category\s*:\s*/i, "").replace(/\s+/g, " ");
  return name.length > 0 && name.length <= 240 && !/[\u0000-\u001f\u007f|#<>\[\]{}]/.test(name) ? name : null;
}

const plain = (value: string) => value.replace(/_/g, " ").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
// Categories about photographs or places that happen to show posters are not poster scans.
const CATEGORY_VETO = /\b(?:not|missing|requested|needed|without|photographs?|photos?|people|persons|streets?|walls?|billboards?|kiosks?|advertising|exhibitions?|museums?|shops?|stores?|cinemas? in|theaters? in|theatres? in)\b|\bposters? (?:in|on|at)\b/;
// Filenames that name the frame/still/event rather than the artwork.
const FILE_VETO = /\b(?:still|stills|screenshot|screen shot|screencap|frame|trailer|lobby|premiere|photo|photograph|wall|exhibition|behind the scenes)\b/;
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/tiff"];

/** Strong evidence only: a film-poster category, or a poster category named after this film. */
export function posterCategoryEvidence(category: string, filmCategory: string): boolean {
  const name = plain(category);
  const film = plain(filmCategory);
  if (CATEGORY_VETO.test(name)) return false;
  if (/\b(?:film|movie|cinema) posters?\b/.test(name)) return true;
  return [`${film} posters`, `${film} poster`, `${film}/posters`, `${film} - posters`, `posters of ${film}`, `posters for ${film}`].includes(name);
}

/** A subcategory such as "<Film> posters" or "<Film>/Posters" that contains only this film's posters. */
export function posterSubcategory(title: unknown, filmCategory: string): string | null {
  if (typeof title !== "string" || !title.startsWith("Category:")) return null;
  const name = commonsCategoryName(title.slice("Category:".length));
  if (!name) return null;
  const lower = plain(name);
  return lower !== plain(filmCategory) && lower.includes(plain(filmCategory)) && /\bposters?\b/.test(lower) && !CATEGORY_VETO.test(lower) ? name : null;
}

function fileCategories(metadata: any): string[] {
  return typeof metadata?.Categories?.value === "string" ? metadata.Categories.value.split("|").map((row: string) => attributionText(row) ?? "").filter(Boolean) : [];
}

/**
 * A category member is a poster only with explicit poster evidence, an image MIME type,
 * a portrait one-sheet aspect ratio and reusable Commons license metadata.
 * Returns a rank (lower is stronger evidence) or null when the file is not accepted.
 */
export function categoryPosterRank(page: any, filmCategory: string, inPosterSubcategory: boolean): { rank: number; fileName: string; poster: MoviePoster } | null {
  if (!page || page.ns !== 6 || typeof page.title !== "string" || !page.title.startsWith("File:") || page.missing) return null;
  const fileName = commonsFileName(page.title.slice("File:".length));
  if (!fileName || !Array.isArray(page.imageinfo) || page.imageinfo.length !== 1) return null;
  const info = page.imageinfo[0];
  if (!info || !IMAGE_MIMES.includes(info.mime)) return null;
  const width = Number(info.width);
  const height = Number(info.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height / width < 1.2 || height / width > 2) return null;
  const lowerName = plain(fileName.replace(/\.[a-z]+$/i, ""));
  if (FILE_VETO.test(lowerName)) return null;
  const categories = fileCategories(info.extmetadata);
  if (categories.some((category) => CATEGORY_VETO.test(plain(category)) && /\bposters?\b/.test(plain(category)))) return null;
  const rank = inPosterSubcategory || categories.some((category) => posterCategoryEvidence(category, filmCategory)) ? 0 : /poster/.test(lowerName) ? 1 : null;
  if (rank === null) return null;
  const poster = normalizeCommonsPoster(info);
  if (!poster) return null;
  return { rank, fileName, poster: { ...poster, attribution: { ...poster.attribution, provider: "commons", rightsKind: "reusable" }, fileName, origin: "commons-category" } };
}

/**
 * Parses one bounded categorymembers+imageinfo generator response. A missing category
 * is an authoritative empty result; listing truncation is accepted as authoritative for
 * the returned page so the lookup stays bounded. Malformed bodies throw.
 */
export function commonsCategoryPosterResponse(data: unknown, filmCategory: string, inPosterSubcategory: boolean): CommonsCategoryPosterResult {
  const body = data as any;
  if (!body || typeof body !== "object" || body.error || body.warnings) throw new Error("commons_invalid_response");
  if (body.continue && Object.keys(body.continue).some((key) => !["gcmcontinue", "iicontinue", "continue"].includes(key))) throw new Error("commons_invalid_response");
  if (body.query === undefined) return { poster: null, posterSubcategory: null };
  if (!Array.isArray(body.query?.pages)) throw new Error("commons_invalid_response");
  const accepted = body.query.pages.map((page: any) => categoryPosterRank(page, filmCategory, inPosterSubcategory))
    .filter((row: unknown): row is NonNullable<ReturnType<typeof categoryPosterRank>> => row !== null)
    .sort((a: { rank: number; fileName: string }, b: { rank: number; fileName: string }) => a.rank - b.rank || a.fileName.localeCompare(b.fileName));
  const subcategories = inPosterSubcategory ? [] : body.query.pages.filter((page: any) => page?.ns === 14)
    .map((page: any) => posterSubcategory(page.title, filmCategory)).filter((name: string | null): name is string => name !== null).sort();
  return { poster: accepted[0]?.poster ?? null, posterSubcategory: subcategories[0] ?? null };
}
