export type PosterAttribution = { provider?: "commons" | "wikipedia"; rightsKind?: "reusable" | "non-free";
  sourceUrl: string; artist: string | null; license: string; licenseUrl: string | null };
export type MoviePoster = { imageUrl: string; attribution: PosterAttribution; fileName?: string; origin?: "commons" | "wikipedia" };

export function commonsFileName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/_/g, " ").trim().normalize("NFC");
  return name.length > 0 && name.length <= 240 && !/[\u0000-\u001f\u007f|#<>\[\]{}:/\\]/.test(name) &&
    /\.(?:jpe?g|png|webp|gif|svg|tiff?)$/i.test(name) ? name : null;
}

/** Commons metadata is HTML. Keep attribution as plain text, never executable markup. */
export function attributionText(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 20_000) return null;
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  const text = value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity: string) => {
      if (!entity.startsWith("#")) return named[entity.toLowerCase()] ?? " ";
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code >= 32 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : " ";
    }).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  // Never silently truncate a required creator credit.
  return text.length > 0 && text.length <= 2000 ? text : null;
}

export function safeWikimediaUrl(value: unknown, host: string, prefix: string): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === host && !url.username && !url.password && !url.port &&
      url.pathname.startsWith(prefix) && !url.hash ? url.href : null;
  } catch { return null; }
}

export function reusablePosterCredit(metadata: any): Pick<PosterAttribution, "artist" | "license" | "licenseUrl"> | null {
  if (!metadata || typeof metadata !== "object") return null;
  const artist = attributionText(metadata.Artist?.value);
  const license = attributionText(metadata.LicenseShortName?.value);
  if (!artist || !license || attributionText(metadata.Restrictions?.value)) return null;
  let licenseUrl: string | null = null;
  const rawLicenseUrl = typeof metadata.LicenseUrl?.value === "string" ? metadata.LicenseUrl.value.replace(/^http:/, "https:") : null;
  if (/^CC BY(?:-SA)? (?:1\.0|2\.0|2\.5|3\.0|4\.0)$/.test(license)) {
    const match = /^(CC BY(?:-SA)?) (\d\.\d)$/.exec(license)!;
    const expected = `/licenses/${match[1] === "CC BY-SA" ? "by-sa" : "by"}/${match[2]}/`;
    licenseUrl = safeWikimediaUrl(rawLicenseUrl, "creativecommons.org", expected);
  } else if (license === "CC0") {
    licenseUrl = safeWikimediaUrl(rawLicenseUrl, "creativecommons.org", "/publicdomain/zero/1.0/");
  } else if (license === "Public domain" && metadata.Copyrighted?.value === "False") {
    licenseUrl = "https://commons.wikimedia.org/wiki/Commons:Copyright_tags#Public_domain";
  }
  return licenseUrl ? { artist, license, licenseUrl } : null;
}

/** Only explicit reusable licenses and complete credit metadata can publish a Commons image. */
export function normalizeCommonsPoster(info: unknown): MoviePoster | null {
  if (!info || typeof info !== "object") return null;
  const row = info as Record<string, any>;
  if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/tiff"].includes(row.mime)) return null;
  const imageUrl = safeWikimediaUrl(row.thumburl, "thumb.wikimedia.org", "/wikipedia/commons/thumb/") ??
    safeWikimediaUrl(row.thumburl, "upload.wikimedia.org", "/wikipedia/commons/");
  const sourceUrl = safeWikimediaUrl(row.descriptionurl, "commons.wikimedia.org", "/wiki/File:");
  const credit = reusablePosterCredit(row.extmetadata);
  return imageUrl && sourceUrl && credit ? { imageUrl, attribution: { sourceUrl, ...credit } } : null;
}

/** Missing files are authoritative; malformed/truncated responses must preserve stored artwork. */
export function commonsPostersResponse(data: unknown, requested: string[]): Record<string, MoviePoster | null> {
  const body = data as any;
  if (!body || body.error || !Array.isArray(body.query?.pages) || body.warnings ||
    (body.continue && Object.keys(body.continue).some((key) => !["iistart", "continue"].includes(key)))) throw new Error("commons_invalid_response");
  const redirects = new Map<string, string>();
  for (const row of [...(body.query.normalized ?? []), ...(body.query.redirects ?? [])]) {
    if (typeof row.from === "string" && typeof row.to === "string" && row.from !== row.to) redirects.set(row.from, row.to);
  }
  const aliases = new Map<string, string[]>();
  for (const name of requested) {
    let title = `File:${name}`;
    const visited = new Set<string>();
    while (redirects.has(title)) {
      if (visited.has(title)) throw new Error("commons_redirect_cycle");
      visited.add(title);
      title = redirects.get(title)!;
    }
    aliases.set(title, [...(aliases.get(title) ?? []), name]);
  }
  const result: Record<string, MoviePoster | null> = {};
  for (const page of body.query.pages) {
    const names = aliases.get(page.title);
    if (!names) continue;
    let poster: MoviePoster | null = null;
    if (page.missing !== true) {
      if (page.ns !== 6 || !Array.isArray(page.imageinfo) || page.imageinfo.length !== 1) throw new Error("commons_incomplete_imageinfo");
      poster = normalizeCommonsPoster(page.imageinfo[0]);
    }
    for (const name of names) result[name] = poster;
  }
  if (requested.some((name) => !Object.prototype.hasOwnProperty.call(result, name))) throw new Error("commons_incomplete_response");
  return result;
}
