import { Bricolage_Grotesque, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Editorial 3-font system for the library:
 * - Bricolage Grotesque (--font-display): expressive architectural display font for titles, mastheads, and hero figures.
 * - Plus Jakarta Sans (--font-sans): sculpted humanist grotesque for body copy, descriptions, and form controls.
 * - JetBrains Mono (--font-mono): crisp technical monospace for tabular numerals, scores, years, and metadata tags.
 * All three include latin-ext for Turkish support.
 */
export const librarySans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
});

export const libraryDisplay = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-display",
});

export const libraryMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-mono",
});

export const libraryFontVariables = `${librarySans.variable} ${libraryDisplay.variable} ${libraryMono.variable}`;
