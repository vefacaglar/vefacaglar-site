export function communityLabels(lang: string) {
  return lang === "tr" ? {
    heading: "Topluluk", siteRating: "Site puanı", rating: "puan", ratings: "puan",
    ratingHint: "Herkese açık profillerin puanlarına göre.", unavailable: "Topluluk etkinliği şu anda kullanılamıyor.",
    empty: "Henüz paylaşılan etkinlik yok.", noDate: "Tarih belirtilmedi", watched: "İzleme:", completed: "Tamamlanma:",
    started: "Başlangıç:", shared: "Paylaşım:", pages: "Topluluk sayfaları", previous: "Önceki", next: "Sonraki",
    pageOf: "Sayfa {current} / {total}", statuses: { backlog: "Oynanacak", playing: "Oynuyor", completed: "Tamamlandı", on_hold: "Beklemede", abandoned: "Bırakıldı" },
  } : {
    heading: "Community", siteRating: "Site rating", rating: "rating", ratings: "ratings",
    ratingHint: "Based on ratings from public profiles.", unavailable: "Community activity is temporarily unavailable.",
    empty: "No shared activity yet.", noDate: "Date not specified", watched: "Watched", completed: "Completed",
    started: "Started", shared: "Shared", pages: "Community pages", previous: "Previous", next: "Next",
    pageOf: "Page {current} of {total}", statuses: { backlog: "Backlog", playing: "Playing", completed: "Completed", on_hold: "On hold", abandoned: "Abandoned" },
  };
}
