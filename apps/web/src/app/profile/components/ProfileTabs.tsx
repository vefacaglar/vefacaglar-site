"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "../../../components/LocaleProvider";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import styles from "../profile.module.css";

type Tab = { key: "overview" | "games" | "movies"; path: string; label: string; count?: number };

/** Overview / games / movies tabs under the profile header. Client-side so the active tab follows navigation. */
export default function ProfileTabs({ basePath, gameCount, movieCount }: { basePath: string; gameCount: number; movieCount?: number }) {
  const locale = useLocale();
  const dict = getDictionary(locale);
  const pathname = decodeURIComponent(usePathname() || "/").toLowerCase();
  const base = decodeURIComponent(basePath).toLowerCase();

  const tabs: Tab[] = [
    { key: "overview", path: basePath, label: dict.profile_overview },
    { key: "games", path: `${basePath}/games`, label: dict.games, count: gameCount },
    { key: "movies", path: `${basePath}/movies`, label: dict.movies, count: movieCount },
  ];

  const isActive = (tab: Tab) => {
    if (tab.key === "overview") return pathname === base;
    const target = `${base}/${tab.key}`;
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  return (
    <nav className={styles.tabs} aria-label={dict.profile_tabs}>
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.key}
            href={localizeHref(tab.path, locale)}
            className={active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
            {tab.count !== undefined && <span className={styles.tabCount}>{tab.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
