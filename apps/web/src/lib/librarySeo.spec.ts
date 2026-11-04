import { describe, expect, it } from "vitest";
import { LIBRARY_NAME, LIBRARY_SECTIONS, libraryMetadata, libraryPreviewImage, libraryTitle } from "./librarySeo";

describe("constants", () => {
  it("names the library and lists its sections in tab order", () => {
    expect(LIBRARY_NAME).toBe("Vefa Library");
    expect(LIBRARY_SECTIONS).toEqual(["games", "movies"]);
  });
});

describe("libraryTitle", () => {
  it("appends the library name to a page title", () => {
    expect(libraryTitle("Elden Ring")).toBe("Elden Ring · Vefa Library");
  });

  it("is just the library name without a title", () => {
    expect(libraryTitle()).toBe("Vefa Library");
    expect(libraryTitle("")).toBe("Vefa Library");
  });
});

describe("libraryPreviewImage", () => {
  it("points at the section's generated preview card", () => {
    expect(libraryPreviewImage("movies")).toEqual({ url: "/movies/opengraph-image", width: 1200, height: 630, alt: "Vefa Library" });
  });
});

describe("libraryMetadata", () => {
  it("builds full Open Graph and Twitter metadata with the section card by default", () => {
    const images = [{ url: "/games/opengraph-image", width: 1200, height: 630, alt: "Vefa Library" }];

    expect(libraryMetadata({ section: "games", description: "Games I play." })).toEqual({
      title: "Vefa Library",
      description: "Games I play.",
      openGraph: { type: "website", siteName: "Vefa Library", title: "Vefa Library", description: "Games I play.", images },
      twitter: { card: "summary_large_image", title: "Vefa Library", description: "Games I play.", images },
    });
  });

  it("uses the cover image instead of the section card when given", () => {
    const meta = libraryMetadata({ section: "games", title: "Hades", description: "d", image: "https://cdn/hades.jpg" });

    expect(meta.title).toBe("Hades · Vefa Library");
    expect(meta.openGraph).toMatchObject({ title: "Hades · Vefa Library", images: [{ url: "https://cdn/hades.jpg" }] });
    expect(meta.twitter).toMatchObject({ title: "Hades · Vefa Library", images: [{ url: "https://cdn/hades.jpg" }] });
  });

  it("falls back to the section card for a null image", () => {
    const meta = libraryMetadata({ section: "movies", description: "d", image: null });
    expect(meta.openGraph).toMatchObject({ images: [libraryPreviewImage("movies")] });
  });

  it("includes alternates and robots only when given", () => {
    const without = libraryMetadata({ section: "games", description: "d" });
    expect(without).not.toHaveProperty("alternates");
    expect(without).not.toHaveProperty("robots");

    const alternates = { canonical: "https://vefacaglar.com/games" };
    const robots = { index: false };
    const meta = libraryMetadata({ section: "games", description: "d", alternates, robots });
    expect(meta.alternates).toBe(alternates);
    expect(meta.robots).toBe(robots);
  });
});
