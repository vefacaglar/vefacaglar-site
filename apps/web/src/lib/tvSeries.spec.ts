import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("./httpClient", () => ({ httpClient: { get: vi.fn() } }));
import { httpClient } from "./httpClient";
import { getTvSeason, getTvSeriesList, tvCount, tvDate, tvEpisodeDate, tvPage, tvRating, tvSeasonName, tvSeriesId, tvSeriesYears } from "./tvSeries";
beforeEach(() => vi.resetAllMocks());
describe("TV catalog URLs", () => {
  it("encodes search and preserves the first page", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ ok: true, json: async () => ({ items: [] }) } as Response);
    await getTvSeriesList(1, "Law & Order");
    expect(httpClient.get).toHaveBeenCalledWith("/api/tv-series?page=1&limit=21&q=Law+%26+Order");
  });
  it("reads a season within the specified parent", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ status: 404 } as Response);
    expect(await getTvSeason(1, 20)).toBeNull();
    expect(httpClient.get).toHaveBeenCalledWith("/api/tv-series/1/seasons/20");
  });
  it("propagates failures without displaying an empty catalog", async () => {
    vi.mocked(httpClient.get).mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(getTvSeriesList(1)).rejects.toThrow("503");
  });
});
describe("TV display helpers", () => {
  it("validates stable IDs without accepting signs, decimals, or overflow", () => {
    expect(tvSeriesId("1")).toBe(1);
    for (const value of ["0", "-1", "1.2", "1e3", " 2", "2147483648"]) expect(tvSeriesId(value)).toBeNull();
    expect(tvPage("2")).toBe(2);
    expect(tvPage("10001")).toBe(1);
    expect(tvPage("2.5")).toBe(1);
  });
  it("distinguishes ongoing, finished and unknown date spans", () => {
    expect(tvSeriesYears({ premiered: "2020-01-01", ended: null, status: "Running" })).toBe("2020–present");
    expect(tvSeriesYears({ premiered: "2020-01-01", ended: "2020-04-01", status: "Ended" })).toBe("2020");
    expect(tvSeriesYears({ premiered: null, ended: null, status: null })).toBeNull();
  });
  it("labels announced episodes without claiming they already aired", () => {
    const now = new Date("2026-11-22T12:00:00Z");
    expect(tvEpisodeDate({ airdate: "2026-11-23", airstamp: null }, now)).toBe("Scheduled 23 November 2026");
    expect(tvEpisodeDate({ airdate: "2026-11-22", airstamp: "2026-11-22T18:00:00Z" }, now)).toBe("Scheduled 22 November 2026");
    expect(tvEpisodeDate({ airdate: "2026-11-21", airstamp: null }, now)).toBe("21 November 2026");
    expect(tvEpisodeDate({ airdate: null, airstamp: null }, now)).toBeNull();
  });
  it("preserves zero ratings, named seasons and null special numbers", () => {
    expect(tvRating(0)).toBe("0.0/10");
    expect(tvRating(null)).toBeNull();
    expect(tvRating(11)).toBeNull();
    expect(tvSeasonName({ number: 1, name: "Season 1" })).toBe("Season 1");
    expect(tvSeasonName({ number: 2, name: "The Next Chapter" })).toBe("Season 2 · The Next Chapter");
    expect(tvSeasonName({ number: null, name: null })).toBe("Specials");
    expect(tvCount(1, "episode")).toBe("1 episode");
    expect(tvCount(2, "episode")).toBe("2 episodes");
    expect(tvDate("2026-01-02")).toBe("2 January 2026");
    expect(tvDate(null)).toBeNull();
  });
});
