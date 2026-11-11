import { describe, expect, it } from "vitest";
import { getDictionary } from "./dictionaries";

describe("movie catalog translations", () => {
  it("provides Turkish labels for browsing and pagination", () => {
    const labels = getDictionary("tr");
    expect(labels.movies).toBe("Filmler");
    expect(labels.movies_search_placeholder).toBe("Film ara");
    expect(labels.movies_no_results).toBe("Aramana uygun film bulunamadı.");
    expect(labels.library_previous).toBe("Önceki");
    expect(labels.movie_role_director).toBe("Yönetmen");
  });
  it("retains English labels for English visitors", () => {
    const labels = getDictionary("en");
    expect(labels.movies).toBe("Movies");
    expect(labels.movies_search_placeholder).toBe("Search movies");
    expect(labels.movie_minutes).toBe("min");
  });
});
