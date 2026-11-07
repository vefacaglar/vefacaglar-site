"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localizeHref } from "../../lib/localizeHref";
import styles from "./LibraryShell.module.css";

export default function ExploreNavigation({ lang, labels }: {
  lang: string;
  labels: { games: string; movies: string };
}) {
  const pathname = usePathname() || "/explore";
  const tabs = [
    { href: "/explore", label: "Explore", active: pathname === "/explore" },
    ...(["games", "movies"] as const).map((section) => ({
      href: `/explore/${section}`,
      label: labels[section],
      active: pathname === `/explore/${section}` || pathname.startsWith(`/explore/${section}/`),
    })),
  ];

  return <nav className={styles.tabs} aria-label="Explore sections">
    {tabs.map((tab) => <Link key={tab.href} href={localizeHref(tab.href, lang)}
      className={tab.active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
      aria-current={tab.active ? "page" : undefined}>{tab.label}</Link>)}
  </nav>;
}
