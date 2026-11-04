import type { Metadata } from "next";

/** The library's own name; its pages never carry the personal site's branding. */
export const LIBRARY_NAME = "vefa/library";

/**
 * Library sections, in tab order. To add one (e.g. books): add its key here, a
 * dictionary label with the same key, and `app/<key>/layout.tsx` rendering
 * `<LibraryShell section="<key>">` plus an `opengraph-image.tsx`.
 */
export const LIBRARY_SECTIONS = ["games", "movies"] as const;

export type LibrarySection = (typeof LIBRARY_SECTIONS)[number];

/** "Elden Ring · vefa/library", or just the library name. */
export function libraryTitle(title?: string): string {
  return title ? `${title} · ${LIBRARY_NAME}` : LIBRARY_NAME;
}

/** The section's generated preview card (see `app/<section>/opengraph-image.tsx`). */
export function libraryPreviewImage(section: LibrarySection) {
  return { url: `/${section}/opengraph-image`, width: 1200, height: 630, alt: LIBRARY_NAME };
}

/**
 * Complete metadata for a library page. Every shareable field is set here so
 * nothing falls back to the root layout's site name, description or og.png.
 * Next replaces `openGraph`/`twitter` as whole objects, so they are always
 * built in full, with the section preview card when there is no cover image.
 */
export function libraryMetadata({
  section,
  title,
  description,
  image,
  alternates,
  robots,
}: {
  section: LibrarySection;
  title?: string;
  description: string;
  image?: string | null;
  alternates?: Metadata["alternates"];
  robots?: Metadata["robots"];
}): Metadata {
  const fullTitle = libraryTitle(title);
  const images = [image ? { url: image } : libraryPreviewImage(section)];

  return {
    title: fullTitle,
    description,
    ...(alternates ? { alternates } : {}),
    ...(robots ? { robots } : {}),
    openGraph: {
      type: "website",
      siteName: LIBRARY_NAME,
      title: fullTitle,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images,
    },
  };
}
