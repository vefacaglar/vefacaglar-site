const dictionaries = {
  en: {
    blog: "blog",
    writings: "latest writings",
    view_all: "view all writings",
    back: "back",
    no_posts: "no posts published yet.",
    current_project: "current project",
    back_to_home: "vefacaglar",
    back_to_blog: "blog",
    about: "about",
    projects: "projects",
    no_projects: "no projects published yet.",
    back_to_projects: "projects",
    featured_project: "featured",
    blog_subtitle: "writing about technical decisions and game development.",
    projects_subtitle: "side projects, open source tools, and experiments.",
    by: "by",
    present: "present",
    page_not_found: "page not found.",
    go_home: "go home",
    previous: "\u2190 previous",
    next: "next \u2192",
    page_of: "page {current} of {total}",
    posts: "posts",
    no_posts_by_author: "no posts published yet.",
    source_code: "github",
    live_demo: "live demo",
    edit_page: "edit page",
    edit_post: "edit post",
    edit_project: "edit project",
  },
  tr: {
    blog: "son yaz\u0131lar",
    writings: "yaz\u0131lar",
    view_all: "t\u00FCm yaz\u0131lar\u0131 g\u00F6r",
    back: "geri",
    no_posts: "hen\u00FCz yaz\u0131 yay\u0131nlanmad\u0131.",
    current_project: "aktif proje",
    back_to_home: "vefacaglar",
    back_to_blog: "yaz\u0131lar",
    about: "hakk\u0131mda",
    projects: "projeler",
    no_projects: "hen\u00FCz proje yay\u0131nlanmad\u0131.",
    back_to_projects: "projeler",
    featured_project: "\u00F6ne \u00E7\u0131kan",
    blog_subtitle: "teknik kararlar ve oyun geli\u015Ftirme \u00FCzerine yaz\u0131lar.",
    projects_subtitle: "geli\u015Ftirdi\u011Fim a\u00E7\u0131k kaynakl\u0131 projeler, ara\u00E7lar ve deneyler.",
    by: "yazar",
    present: "devam ediyor",
    page_not_found: "sayfa bulunamad\u0131.",
    go_home: "ana sayfaya d\u00F6n",
    previous: "\u2190 \u00F6nceki",
    next: "sonraki \u2192",
    page_of: "sayfa {current} / {total}",
    posts: "yaz\u0131lar",
    no_posts_by_author: "hen\u00FCz yaz\u0131 yay\u0131nlanmad\u0131.",
    source_code: "github",
    live_demo: "canl\u0131 demo",
    edit_page: "sayfay\u0131 d\u00FCzenle",
    edit_post: "yaz\u0131y\u0131 d\u00FCzenle",
    edit_project: "projeyi d\u00FCzenle",
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
