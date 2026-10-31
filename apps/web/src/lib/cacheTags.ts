import { revalidateTag } from "next/cache";

/**
 * Single tag for every cached public API response. The site is small and edits are
 * rare, so any dashboard mutation simply invalidates all public content instead of
 * tracking which pages a given change touches.
 */
export const PUBLIC_CONTENT_TAG = "public-content";

export function revalidatePublicContent() {
  revalidateTag(PUBLIC_CONTENT_TAG);
}
