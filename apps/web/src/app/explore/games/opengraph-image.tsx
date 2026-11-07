import { renderLibraryOgImage } from "../../../components/library/libraryOgImage";

// Default link preview for /explore/games pages that have no image of their own.
export const alt = "Vefa Library";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderLibraryOgImage("games");
}
