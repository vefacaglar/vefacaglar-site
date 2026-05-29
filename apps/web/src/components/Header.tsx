"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLocale } from "./LocaleProvider";
import styles from "./Header.module.css";

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
  const prefix = locale === "tr" ? "/tr" : "";
  const pagePath = rawPath.replace(/^\/tr/, "") || "/";

  const getBreadcrumbs = () => {
    const isHome = pagePath === "/" || pagePath === "";
    const items: Array<{ label: string; href: string | null }> = [
      { label: dict.back_to_home, href: isHome ? null : `${prefix}/` }
    ];

    if (isHome) return items;

    if (pagePath.startsWith("/about")) {
      items.push({ label: dict.about.toLowerCase(), href: null });
    } else if (pagePath.startsWith("/projects")) {
      if (pagePath !== "/projects") {
        items.push({ label: dict.projects.toLowerCase(), href: `${prefix}/projects` });
      } else {
        items.push({ label: dict.projects.toLowerCase(), href: null });
      }
    } else if (pagePath.startsWith("/packages")) {
      if (pagePath !== "/packages") {
        items.push({ label: "packages", href: `${prefix}/packages` });
      } else {
        items.push({ label: "packages", href: null });
      }
    } else if (pagePath.startsWith("/blog")) {
      if (pagePath !== "/blog") {
        items.push({ label: dict.back_to_blog.toLowerCase(), href: `${prefix}/blog` });
      } else {
        items.push({ label: dict.back_to_blog.toLowerCase(), href: null });
      }
    } else if (pagePath.startsWith("/author/")) {
      const parts = pagePath.split("/");
      const username = parts[2] || "author";
      items.push({ label: username.toLowerCase(), href: null });
    }

    return items;
  };

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
      <div className={styles.right}>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
