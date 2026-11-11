/** Keep retry semantics separate from the message shown for a failed request. */
export function movieActionError(status: number, message: unknown, lang: string): string {
  if (lang !== "tr") return typeof message === "string" && message ? message : "Request failed.";
  if (status === 400 || status === 422) return "Bilgiler geçersiz. Lütfen kontrol edip tekrar dene.";
  if (status === 401) return "Lütfen tekrar giriş yap.";
  if (status === 403) return "Bu işlemi yapma yetkin yok.";
  if (status === 404) return "Film veya izleme kaydı bulunamadı.";
  if (status === 409) return "Bu izleme kaydı mevcut bir kayıtla çakışıyor. Sayfayı yenileyip tekrar dene.";
  if (status === 429) return "Çok fazla istek gönderildi. Lütfen daha sonra tekrar dene.";
  return "İşlem tamamlanamadı. Lütfen tekrar dene.";
}

export function movieActionConnectionError(lang: string): string {
  return lang === "tr" ? "Sunucuya bağlanılamadı." : "Server connection error.";
}
