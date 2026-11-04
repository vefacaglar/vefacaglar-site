import { ImageResponse } from "next/og";
import { LIBRARY_NAME, LIBRARY_SECTIONS, type LibrarySection } from "../../lib/librarySeo";

/*
 * Preview card for shared library links. ImageResponse (Satori) only supports the
 * `style` prop, so inline styles are a necessary exception to the CSS Modules rule
 * here and only here. Colors must mirror globals.css (it cannot read CSS vars).
 */
const BG = "#000000"; // --bg
const HEADING = "#ffffff"; // --text-heading
const MUTED = "#8e8e8e"; // --muted
const BORDER = "#2d2d2d"; // --border
const ACCENT = "#A89276"; // --accent

export const OG_SIZE = { width: 1200, height: 630 };

/** Fetch just the glyphs we draw from Google Fonts; fall back to the default font if offline. */
async function loadFiraCode(weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Fira+Code:wght@${weight}&text=${encodeURIComponent(text)}`
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
  const glyphs = `${LIBRARY_NAME}${LIBRARY_SECTIONS.join("")}`;
  const [light, bold] = await Promise.all([loadFiraCode(300, glyphs), loadFiraCode(600, glyphs)]);
  const fonts = [
    ...(light ? [{ name: "Fira Code", data: light, weight: 300 as const, style: "normal" as const }] : []),
    ...(bold ? [{ name: "Fira Code", data: bold, weight: 600 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: BG,
          color: HEADING,
          fontFamily: fonts.length ? "Fira Code" : undefined,
        }}
      >
        <div style={{ display: "flex", fontSize: 36, letterSpacing: "-0.05em" }}>
          <span style={{ color: MUTED, fontWeight: 300 }}>vefa</span>
          <span style={{ color: ACCENT, fontWeight: 300, margin: "0 4px" }}>/</span>
          <span style={{ fontWeight: 600 }}>library</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 220, fontWeight: 300, letterSpacing: "-0.075em", lineHeight: 0.9 }}>
            {section}
          </div>
          <div style={{ display: "flex", gap: 40, marginTop: 48, borderTop: `1px solid ${BORDER}` }}>
            {LIBRARY_SECTIONS.map((key) => (
              <span
                key={key}
                style={{
                  paddingTop: 20,
                  fontSize: 30,
                  color: key === section ? HEADING : MUTED,
                  borderTop: `3px solid ${key === section ? ACCENT : BG}`,
                  marginTop: -2,
                }}
              >
                {key}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined }
  );
}
