import { renderLibraryOgImage } from "../../components/library/libraryOgImage";

export const alt = "Explore · Vefa Library";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderLibraryOgImage();
}
