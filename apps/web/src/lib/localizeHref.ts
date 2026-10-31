/** Adds `?lang=tr` to an internal href when the active language is Turkish. */
export function localizeHref(href: string, lang: string): string {
  if (lang !== "tr") return href;
  const [pathAndQuery, hash] = href.split("#", 2);
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("lang", "tr");
  return `${path || "/"}?${params.toString()}${hash !== undefined ? `#${hash}` : ""}`;
}
