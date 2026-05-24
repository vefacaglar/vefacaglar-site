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
    blog_subtitle: "Writing about technical decisions and game development.",
    projects_subtitle: "Side projects, open source tools, and experiments.",
    by: "by",
    present: "Present",
    page_not_found: "Page not found.",
    go_home: "Go home",
    previous: "\u2190 Previous",
    next: "Next \u2192",
    page_of: "Page {current} of {total}",
    posts: "Posts",
    no_posts_by_author: "No posts published yet.",
    source_code: "GitHub",
    live_demo: "Live Demo",
  },
  tr: {
    blog: "Son yaz\u0131lar",
    writings: "Yaz\u0131lar",
    view_all: "T\u00FCm yaz\u0131lar\u0131 g\u00F6r",
    back: "Geri",
    no_posts: "Hen\u00FCz yaz\u0131 yay\u0131nlanmad\u0131.",
    current_project: "Aktif Proje",
    back_to_home: "vefacaglar",
    back_to_blog: "yaz\u0131lar",
    about: "hakk\u0131mda",
    projects: "projeler",
    no_projects: "Hen\u00FCz proje yay\u0131nlanmad\u0131.",
    back_to_projects: "projeler",
    featured_project: "\u00D6ne \u00C7\u0131kan",
    blog_subtitle: "Teknik kararlar ve oyun geli\u015Ftirme \u00FCzerine yaz\u0131lar.",
    projects_subtitle: "Geli\u015Ftirdi\u011Fim a\u00E7\u0131k kaynakl\u0131 projeler, ara\u00E7lar ve deneyler.",
    by: "yazar",
    present: "Devam Ediyor",
    page_not_found: "Sayfa bulunamad\u0131.",
    go_home: "Ana sayfaya d\u00F6n",
    previous: "\u2190 \u00D6nceki",
    next: "Sonraki \u2192",
    page_of: "Sayfa {current} / {total}",
    posts: "Yaz\u0131lar",
    no_posts_by_author: "Hen\u00FCz yaz\u0131 yay\u0131nlanmad\u0131.",
    source_code: "GitHub",
    live_demo: "Canl\u0131 Demo",
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
