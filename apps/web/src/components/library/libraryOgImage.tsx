import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { LIBRARY_SECTIONS, type LibrarySection } from "../../lib/librarySeo";
import { getDictionary } from "../../dictionaries";

/*
 * Preview card for shared library links. ImageResponse (Satori) only supports the
 * `style` prop, so inline styles are a necessary exception to the CSS Modules rule
 * here and only here. Colors must mirror the [data-library] palette in globals.css
 * (Satori cannot read CSS vars).
 */
const BG = "#141414"; // --bg
const SURFACE = "#1a1a1a"; // --surface
const HEADING = "#f4f4f4"; // --text-heading
const MUTED = "#9b9b9b"; // --muted
const BORDER = "#292929"; // --border
const ACCENT = "#8aa4c8"; // --accent

export const OG_SIZE = { width: 1200, height: 630 };

async function loadBundledFont(file: string): Promise<ArrayBuffer | null> {
  const candidates = [
    () => readFile(new URL(`../../fonts/${file}`, import.meta.url)),
    () => readFile(join(process.cwd(), "apps/web/src/fonts", file)),
    () => readFile(join(process.cwd(), "src/fonts", file)),
  ];

  for (const read of candidates) {
    try {
      const buffer = await read();
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch {
      // try next candidate
    }
  }

  return null;
}

export async function renderLibraryOgImage(section?: LibrarySection) {
  // Preview cards are shared in English; labels come from the dictionary in sentence case.
  const dict = getDictionary("en");
  const [regular, semibold] = await Promise.all([
    loadBundledFont("FiraCode-Regular.ttf"),
    loadBundledFont("FiraCode-SemiBold.ttf"),
  ]);
  const fonts = [
    ...(regular ? [{ name: "Fira Code", data: regular, weight: 500 as const, style: "normal" as const }] : []),
    ...(semibold ? [{ name: "Fira Code", data: semibold, weight: 600 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: HEADING,
          fontFamily: fonts.length ? "Fira Code" : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 120,
            padding: "0 80px",
            borderBottom: `1px solid ${BORDER}`,
            fontSize: 36,
          }}
        >
          <span style={{ fontWeight: 600 }}>Vefa</span>
          <span style={{ fontWeight: 500, color: MUTED, marginLeft: 10 }}>Library</span>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "0 80px",
            background: SURFACE,
          }}
        >
          <div style={{ display: "flex", fontSize: 128, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>
            {section ? dict[section] : "Explore"}
          </div>
          <div style={{ display: "flex", gap: 44, marginTop: 48 }}>
            {LIBRARY_SECTIONS.map((key) => (
              <span
                key={key}
                style={{
                  paddingBottom: 18,
                  fontSize: 30,
                  fontWeight: 500,
                  color: key === section ? HEADING : MUTED,
                  borderBottom: `3px solid ${key === section ? ACCENT : SURFACE}`,
                }}
              >
                {dict[key]}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined }
  );
}
