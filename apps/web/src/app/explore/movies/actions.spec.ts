import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../../../lib/lang", () => ({ getActiveLanguage: vi.fn() }));
vi.mock("../../../lib/session", () => ({ getSessionUser: vi.fn() }));
vi.mock("../../../lib/httpClient", () => ({ httpClient: { post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import { cookies } from "next/headers";
import { getActiveLanguage } from "../../../lib/lang";
import { httpClient } from "../../../lib/httpClient";
import { createMovieWatch, setMovieRating } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getActiveLanguage).mockResolvedValue("tr");
  vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: "token" }) } as never);
});

describe("movie actions", () => {
  it("localizes a missing session", async () => {
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined } as never);
    expect(await setMovieRating("film", 8)).toEqual({ error: "Lütfen tekrar giriş yap." });
  });
  it("localizes an API failure and preserves the uncertain retry marker", async () => {
    vi.mocked(httpClient.post).mockResolvedValue(new Response(JSON.stringify({ message: "Internal server error." }), { status: 500 }));
    expect(await createMovieWatch("film", "id", null, null, false)).toEqual({ error: "İşlem tamamlanamadı. Lütfen tekrar dene.", uncertain: true });
  });
  it("preserves English API errors and does not mark client errors uncertain", async () => {
    vi.mocked(getActiveLanguage).mockResolvedValue("en");
    vi.mocked(httpClient.put).mockResolvedValue(new Response(JSON.stringify({ message: "Choose a valid calendar date." }), { status: 400 }));
    expect(await setMovieRating("film", 8)).toEqual({ error: "Choose a valid calendar date.", uncertain: false });
  });
  it("keeps network failures uncertain and localized", async () => {
    vi.mocked(httpClient.post).mockRejectedValue(new Error("network"));
    expect(await createMovieWatch("film", "id", null, null, false)).toEqual({ error: "Sunucuya bağlanılamadı.", uncertain: true });
  });
});
