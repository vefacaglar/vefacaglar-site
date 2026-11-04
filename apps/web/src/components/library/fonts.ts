import { Geist } from "next/font/google";

/**
 * The library's only typeface. Geist is a plain, neutral grotesque built for
 * interfaces: even texture at small sizes, clear figures (set with tabular
 * numerals where they line up in columns) and no italic or display cuts to
 * tempt decoration. latin-ext covers Turkish.
 */
export const librarySans = Geist({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
});
