"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
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
  const pathname = usePathname();

  // Helper to determine the breadcrumbs
  const getBreadcrumbs = () => {
    const isHome = !pathname || pathname === "/";
    const items: Array<{ label: string; href: string | null }> = [
      { label: "vefacaglar", href: isHome ? null : "/" }
    ];

    if (isHome) {
      return items;
    }

    if (pathname.startsWith("/about")) {
      items.push({ label: dict.about.toLowerCase(), href: null });
    } else if (pathname.startsWith("/projects")) {
      if (pathname !== "/projects") {
        items.push({ label: dict.projects.toLowerCase(), href: "/projects" });
      } else {
        items.push({ label: dict.projects.toLowerCase(), href: null });
      }
    } else if (pathname.startsWith("/blog")) {
      if (pathname !== "/blog") {
        items.push({ label: dict.back_to_blog.toLowerCase(), href: "/blog" });
      } else {
        items.push({ label: dict.back_to_blog.toLowerCase(), href: null });
      }
    } else if (pathname.startsWith("/author/")) {
      const parts = pathname.split("/");
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
