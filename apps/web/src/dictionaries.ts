const dictionaries = {
  en: {
    blog: "Blog",
    writings: "Latest writings",
    view_all: "View all writings",
    back: "Back",
    no_posts: "No posts published yet.",
    current_project: "Current Project",
    back_to_home: "vefacaglar",
    back_to_blog: "blog",
    about: "about",
    projects: "projects",
    no_projects: "No projects published yet.",
    back_to_projects: "projects",
    featured_project: "Featured",
  },
  tr: {
    blog: "Son yazılar",
    writings: "Yazılar",
    view_all: "Tüm yazıları gör",
    back: "Geri",
    no_posts: "Henüz yazı yayınlanmadı.",
    current_project: "Aktif Proje",
    back_to_home: "vefacaglar",
    back_to_blog: "yazılar",
    about: "hakkımda",
    projects: "projeler",
    no_projects: "Henüz proje yayınlanmadı.",
    back_to_projects: "projeler",
    featured_project: "Öne Çıkan",
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
