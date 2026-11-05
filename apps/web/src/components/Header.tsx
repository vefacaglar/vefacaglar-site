"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { localizeHref } from "../lib/localizeHref";
import styles from "./Header.module.css";

const LIBRARY_PREFIXES = ["/games", "/movies", "/profile"];

interface HeaderProps {
  dict: {
    back_to_home: string;
    back_to_blog: string;
    about: string;
    projects: string;
  };
}

export default function Header({ dict }: HeaderProps) {
  const rawPath = usePathname();
  const locale = useLocale();
  const pagePath = rawPath || "/";
  const href = (path: string) => localizeHref(path, locale);

  const getBreadcrumbs = () => {
    const isHome = pagePath === "/" || pagePath === "";
    const items: Array<{ label: string; href: string | null }> = [
      { label: dict.back_to_home, href: isHome ? null : href("/") }
    ];

    if (isHome) return items;

    if (pagePath.startsWith("/about")) {
      items.push({ label: dict.about, href: null });
    } else if (pagePath.startsWith("/projects")) {
      if (pagePath !== "/projects") {
        items.push({ label: dict.projects, href: href("/projects") });
      } else {
        items.push({ label: dict.projects, href: null });
      }
    } else if (pagePath.startsWith("/packages")) {
      if (pagePath !== "/packages") {
        items.push({ label: "Packages", href: "/packages" });
      } else {
        items.push({ label: "Packages", href: null });
      }
    } else if (pagePath.startsWith("/blog")) {
      if (pagePath !== "/blog") {
        items.push({ label: dict.back_to_blog, href: href("/blog") });
      } else {
        items.push({ label: dict.back_to_blog, href: null });
      }
    } else if (pagePath.startsWith("/author/")) {
      const parts = pagePath.split("/");
      const username = parts[2] || "Author";
      items.push({ label: username, href: null });
    }

    return items;
  };

  // The library (games, movies, profile) is its own section with its own header.
  if (LIBRARY_PREFIXES.some((prefix) => pagePath === prefix || pagePath.startsWith(`${prefix}/`))) {
    return null;
  }

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {breadcrumbs.map((crumb, idx) => (
          <span key={idx} className={styles.crumbWrapper}>
            {idx > 0 && <span className={styles.separator}>|</span>}
            {crumb.href ? (
              <Link href={crumb.href} className={styles.link}>
                {crumb.label}
              </Link>
            ) : (
              <span className={styles.current}>{crumb.label}</span>
            )}
          </span>
        ))}
      </div>
    </header>
  );
}
