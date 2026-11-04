import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and joins words with dashes", () => {
    expect(slugify("Hello World")).toBe("hello-world");
    expect(slugify("Elden Ring: Shadow of the Erdtree")).toBe("elden-ring-shadow-of-the-erdtree");
  });

  it("transliterates Turkish letters", () => {
    expect(slugify("Çağlar Şöyle İyi")).toBe("caglar-soyle-iyi");
    expect(slugify("ığüşöç ĞÜŞÖÇIİ")).toBe("igusoc-gusocii");
  });

  it("turns whitespace and underscores into single dashes and trims dashes", () => {
    expect(slugify("  Trim me  ")).toBe("trim-me");
    expect(slugify("a_b\tc\nd")).toBe("a-b-c-d");
    expect(slugify("a -- b")).toBe("a-b");
    expect(slugify("--x--")).toBe("x");
  });

  it("drops other punctuation and symbols", () => {
    expect(slugify("100% Orange Juice!")).toBe("100-orange-juice");
    expect(slugify("Ratchet & Clank")).toBe("ratchet-clank");
    expect(slugify("Half-Life 2")).toBe("half-life-2");
  });

  it("drops non-Turkish accented letters instead of transliterating them", () => {
    // NOTE: only Turkish letters are mapped; "é" is removed, so "Pokémon" → "pokmon".
    expect(slugify("Pokémon")).toBe("pokmon");
    expect(slugify("Café")).toBe("caf");
  });

  it("is empty when nothing usable remains", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});
