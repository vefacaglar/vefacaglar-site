export function localizeHref(href: string, lang: string): string {
  if (lang === "tr" && !href.startsWith("/tr")) {
    return `/tr${href}`;
  }
  return href;
}
