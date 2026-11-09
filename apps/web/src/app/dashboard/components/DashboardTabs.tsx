import Link from "next/link";
import styles from "../dashboard.module.css";
import ds from "../../../lib/dashboard-strings";

export type DashboardTab = "content" | "packages" | "games" | "movies" | "jobs";

const TABS: { id: DashboardTab; href: string }[] = [
  { id: "content", href: "/dashboard" },
  { id: "packages", href: "/dashboard/packages" },
  { id: "games", href: "/dashboard/games" },
  { id: "movies", href: "/dashboard/movies" },
  { id: "jobs", href: "/dashboard/jobs" },
];

/** Top-level dashboard navigation shared by every dashboard section. */
export default function DashboardTabs({ active }: { active: DashboardTab }) {
  return (
    <div className={styles.tabsContainer}>
      {TABS.map((tab) => (
        <Link key={tab.id} href={tab.href} className={tab.id === active ? `${styles.tab} ${styles.activeTab}` : styles.tab}>
          {ds.nav.tabs[tab.id]}
        </Link>
      ))}
    </div>
  );
}
