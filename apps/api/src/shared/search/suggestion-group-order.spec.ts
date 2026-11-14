import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { orderSuggestionGroups, suggestionMatch } from "./suggestion-group-order";

describe("suggestionMatch", () => {
  it("ranks an exact text above a whole-word, a word-prefix and a fuzzy match", () => {
    expect(suggestionMatch("cargo", "Cargo")).toEqual({ tier: 4, coverage: 1, start: true });
    expect(suggestionMatch("Megan  Fox", "megan fox")).toEqual({ tier: 4, coverage: 1, start: true });
    expect(suggestionMatch("megan", "Megan Fox")).toEqual({ tier: 3, coverage: 0.5, start: true });
    expect(suggestionMatch("halo", "Twins Halo")).toEqual({ tier: 3, coverage: 0.5, start: false });
    expect(suggestionMatch("megan", "Megane")).toEqual({ tier: 2, coverage: 1, start: true });
    expect(suggestionMatch("megan f", "Megan Fox")).toEqual({ tier: 2, coverage: 1, start: true });
    expect(suggestionMatch("ubisoft", "Ubi Soft: Happy New Year 2001")).toEqual({ tier: 0, coverage: 0, start: false });
    expect(suggestionMatch("starfield", "Starfeld")).toEqual({ tier: 1, coverage: 1, start: true });
    expect(suggestionMatch("starfeild", "Starfield")).toEqual({ tier: 1, coverage: 1, start: true });
    expect(suggestionMatch("skyrm", "Skyriver")).toEqual({ tier: 1, coverage: 1, start: true });
    expect(suggestionMatch("halo", "Hale")).toEqual({ tier: 0, coverage: 0, start: false });
  });

  it("ignores case, punctuation and diacritics", () => {
    expect(suggestionMatch("pokemon", "Pokémon")).toEqual({ tier: 4, coverage: 1, start: true });
    expect(suggestionMatch("spider man", "Spider-Man")).toEqual({ tier: 4, coverage: 1, start: true });
    expect(suggestionMatch("megan", "Megan Thee Stallion: In Her Words")).toEqual({ tier: 3, coverage: 1 / 6, start: true });
  });

  it("treats blank input as no match", () => {
    expect(suggestionMatch("  ", "Cargo")).toEqual({ tier: 0, coverage: 0, start: false });
    expect(suggestionMatch("cargo", "")).toEqual({ tier: 0, coverage: 0, start: false });
  });
});

describe("orderSuggestionGroups", () => {
  const megan = [
    { key: "people", texts: ["Megan Fox", "Megan Mullally", "Megan Ellison", "Megan Park", "Megan Ward"] },
    { key: "movies", texts: ["Megan Leavey", "Megan Is Missing", "Megane", "Megan Escort Deluxe", "Megan Thee Stallion: In Her Words"] },
  ];

  it("puts people first for a first name that only starts film titles", () => {
    expect(orderSuggestionGroups("megan", megan)).toEqual(["people", "movies"]);
  });

  it("puts films first when one is titled exactly like the query, wherever it is in the group", () => {
    expect(orderSuggestionGroups("cargo", [
      { key: "people", texts: ["Gretcha Cargo", "Jean-Pierre Cargol", "Carlo Ponti"] },
      { key: "movies", texts: ["Cargo 200", "Cargo", "Cargo"] },
    ])).toEqual(["movies", "people"]);
  });

  it("puts games first for an exact title and companies first for a company name", () => {
    const groups = (developers: string[], publishers: string[], games: string[]) => [
      { key: "developers", texts: developers }, { key: "publishers", texts: publishers }, { key: "games", texts: games },
    ];
    expect(orderSuggestionGroups("starfield", groups(["Starfield Gaming", "Mary Stanfield"], ["Starfield Gaming"],
      ["Starfield", "Starfield Wars", "Starfeld"]))).toEqual(["games", "developers", "publishers"]);
    expect(orderSuggestionGroups("bethesda", groups(["Bethesda Softworks", "Bethesda Game Studios"],
      ["Bethesda Softworks", "Bethesda Game Studios"], ["Bethesda Pinball"]))).toEqual(["developers", "publishers", "games"]);
    expect(orderSuggestionGroups("ubisoft", groups(["Ubisoft Montreal"], ["Ubisoft"],
      ["Ubi Soft: Happy New Year 2001"]))).toEqual(["publishers", "developers", "games"]);
  });

  it("ranks typo queries by the fuzzy match instead of falling back to input order", () => {
    const groups = (developers: string[], games: string[]) => [{ key: "developers", texts: developers }, { key: "games", texts: games }];
    expect(orderSuggestionGroups("starfeild", groups(["Starfield Gaming", "Mary Stanfield"],
      ["Starfield", "Starfield Wars", "Starfield Legacy"]))).toEqual(["games", "developers"]);
    expect(orderSuggestionGroups("skyrm", groups(["SkyRiver Studios", "Skyrocket Toys"],
      ["The Elder Scrolls V: Skyrim", "Skirmish", "SkyRig", "Skyreach"]))).toEqual(["games", "developers"]);
  });

  it("prefers the group whose best match covers more of its text", () => {
    expect(orderSuggestionGroups("dark knight", [
      { key: "people", texts: ["Dark Knight Rider Fan"] },
      { key: "movies", texts: ["The Dark Knight"] },
    ])).toEqual(["movies", "people"]);
  });

  it("on equal coverage, prefers the group whose text starts with the query", () => {
    expect(orderSuggestionGroups("halo", [
      { key: "developers", texts: ["Twins Halo", "Bone Halo"] },
      { key: "publishers", texts: ["Twins Halo"] },
      { key: "games", texts: ["Halo Infinite", "Halo: Combat Evolved", "Halo 3"] },
    ])).toEqual(["games", "developers", "publishers"]);
  });

  it("moves empty groups last and keeps the given order on ties", () => {
    expect(orderSuggestionGroups("nolan", [{ key: "people", texts: [] }, { key: "movies", texts: ["Nolan"] }])).toEqual(["movies", "people"]);
    expect(orderSuggestionGroups("x", [{ key: "people", texts: [] }, { key: "movies", texts: [] }])).toEqual(["people", "movies"]);
    expect(orderSuggestionGroups("zzz", [{ key: "people", texts: ["Alpha"] }, { key: "movies", texts: ["Beta"] }])).toEqual(["people", "movies"]);
  });
});
