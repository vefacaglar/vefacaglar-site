const dictionaries = {
  en: {
    blog: "Blog",
    writings: "Writings",
    view_all: "View all writings",
    back: "Back",
    no_posts: "No posts published yet.",
    current_project: "Current Project",
  },
  tr: {
    blog: "Yazılar",
    writings: "Yazılar",
    view_all: "Tüm yazıları gör",
    back: "Geri",
    no_posts: "Henüz yazı yayınlanmadı.",
    current_project: "Aktif Proje",
  }
};

export type Locale = "en" | "tr";

export const getDictionary = (lang: string) => {
  const cleanLang = lang.trim().toLowerCase();
  if (cleanLang.startsWith("tr")) {
    return dictionaries.tr;
  }
  return dictionaries.en;
};
