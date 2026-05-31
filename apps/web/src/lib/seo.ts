import type { Metadata } from "next";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://vefacaglar.com"
).replace(/\/$/, "");

/**
 * Build canonical + hreflang alternates for a locale-agnostic path.
 *
 * `path` is the path WITHOUT the locale prefix (e.g. "/blog/foo", or "" for
 * the home page).
 *
 * For sections that are translated (`bilingual: true`, the default) the
 * canonical points at the variant matching the active language and `languages`
 * advertises both the English and Turkish URLs so Google can link the two
 * translations.
 *
 * For English-only sections (`bilingual: false`, e.g. packages/docs) the
 * canonical always points at the English URL — even when the page is reached
 * via a `/tr` URL — so any accidental Turkish-prefixed hit consolidates back to
 * the single English page instead of registering as duplicate content.
 */
export function localizedAlternates(
  path: string,
  lang: string,
  { bilingual = true }: { bilingual?: boolean } = {}
): Metadata["alternates"] {
  const clean = path === "/" ? "" : path;
  const en = `${SITE_URL}${clean}`;
  const tr = `${SITE_URL}/tr${clean}`;

  if (!bilingual) {
    return { canonical: en };
  }

  return {
    canonical: lang === "tr" ? tr : en,
    languages: {
      en,
      tr,
      "x-default": en,
    },
  };
}
