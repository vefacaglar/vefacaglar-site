import { ImageResponse } from "next/og";
import { LIBRARY_SECTIONS, type LibrarySection } from "../../lib/librarySeo";
import { getDictionary } from "../../dictionaries";

/*
 * Preview card for shared library links. ImageResponse (Satori) only supports the
 * `style` prop, so inline styles are a necessary exception to the CSS Modules rule
 * here and only here. Colors must mirror the [data-library] palette in globals.css
 * (Satori cannot read CSS vars).
 */
const BG = "#171411"; // --bg
const SURFACE = "#201c18"; // --surface
const HEADING = "#f6efe2"; // --text-heading
const MUTED = "#a29788"; // --muted
const BORDER = "#36302a"; // --border
const ACCENT = "#cfa35e"; // --accent

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
    loadGoogleFont("Newsreader:opsz,wght@72,400", glyphs),
    loadGoogleFont("Newsreader:opsz,wght@72,600", glyphs),
  ]);
  const fonts = [
    ...(regular ? [{ name: "Newsreader", data: regular, weight: 400 as const, style: "normal" as const }] : []),
    ...(semibold ? [{ name: "Newsreader", data: semibold, weight: 600 as const, style: "normal" as const }] : []),
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
          fontFamily: fonts.length ? "Newsreader" : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 132,
            padding: "0 80px",
            borderBottom: `1px solid ${BORDER}`,
            fontSize: 40,
          }}
        >
          <span style={{ fontWeight: 600 }}>Vefa</span>
          <span style={{ fontWeight: 400, color: MUTED, marginLeft: 12 }}>Library</span>
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
          <div style={{ display: "flex", fontSize: 196, fontWeight: 400, letterSpacing: "-0.02em", lineHeight: 1 }}>
            {dict[section]}
          </div>
          <div style={{ display: "flex", gap: 48, marginTop: 40 }}>
            {LIBRARY_SECTIONS.map((key) => (
              <span
                key={key}
                style={{
                  paddingBottom: 18,
                  fontSize: 32,
                  color: key === section ? HEADING : MUTED,
                  borderBottom: `2px solid ${key === section ? ACCENT : SURFACE}`,
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
