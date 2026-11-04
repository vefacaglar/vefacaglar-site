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

/** Fetch just the glyphs we draw from Google Fonts; fall back to the default font if offline. */
async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`
    ).then((res) => res.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function renderLibraryOgImage(section: LibrarySection) {
  // Preview cards are shared in English; labels come from the dictionary in sentence case.
  const dict = getDictionary("en");
  const labels = LIBRARY_SECTIONS.map((key) => dict[key]);
  const glyphs = `Vefa Library${labels.join("")}`;
  const [regular, semibold] = await Promise.all([
    loadGoogleFont("Geist:wght@500", glyphs),
    loadGoogleFont("Geist:wght@600", glyphs),
  ]);
  const fonts = [
    ...(regular ? [{ name: "Geist", data: regular, weight: 500 as const, style: "normal" as const }] : []),
    ...(semibold ? [{ name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const }] : []),
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
          fontFamily: fonts.length ? "Geist" : undefined,
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
            {dict[section]}
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
