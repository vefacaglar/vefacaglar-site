import { describe, expect, it } from "vitest";
import { communityLabels } from "./communityLabels";

describe("community labels", () => {
  it("provides Turkish movie community and pagination text", () => {
    expect(communityLabels("tr")).toMatchObject({ heading: "Topluluk", noDate: "Tarih belirtilmedi", watched: "İzleme:",
      unavailable: "Topluluk etkinliği şu anda kullanılamıyor.", empty: "Henüz paylaşılan etkinlik yok.",
      previous: "Önceki", next: "Sonraki", pageOf: "Sayfa {current} / {total}" });
  });
  it("preserves English labels used by game pages", () => {
    expect(communityLabels("en")).toMatchObject({ heading: "Community", watched: "Watched", previous: "Previous", pageOf: "Page {current} of {total}" });
  });
});
