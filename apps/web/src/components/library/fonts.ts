import { Newsreader } from "next/font/google";

/**
 * The library's text face. Newsreader is a variable serif with an optical-size
 * axis: at display sizes it tightens into a sharp, high-contrast title face, at
 * reading sizes it opens up for descriptions and notes — one family that reads
 * like a printed programme or archive catalogue. Fira Code (the site's own
 * face) stays on for figures: years, scores, hours, counts.
 */
export const librarySerif = Newsreader({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-serif",
});
