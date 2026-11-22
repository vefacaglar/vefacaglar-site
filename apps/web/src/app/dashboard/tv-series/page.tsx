import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../../lib/session";
import ds from "../../../lib/dashboard-strings";
import { logoutAction } from "../actions";
import DashboardTabs from "../components/DashboardTabs";
import styles from "../dashboard.module.css";
import tvStyles from "./tv-series.module.css";
import { getTvDashboardStats, listDashboardTv } from "./actions";

export const dynamic = "force-dynamic";
const format = (value: number) => value.toLocaleString("en-US");

export default async function TvDashboard({ searchParams }: { searchParams: Promise<{ page?: string; limit?: string; q?: string; hydration?: string }> }) {
  const params = await searchParams;
  if (!(await cookies()).get("session_token")?.value) redirect("/dashboard/login");
  await requireAdmin();
  const page = Math.min(10000, Math.max(1, Math.floor(Number(params.page)) || 1));
  const limit = [10, 50, 100].includes(Number(params.limit)) ? Number(params.limit) : 50;
  const q = (params.q ?? "").slice(0, 140);
  const hydration = params.hydration === "complete" || params.hydration === "pending" ? params.hydration : "all";
  const [statsRes, listRes] = await Promise.all([getTvDashboardStats(), listDashboardTv({ page, limit, q, hydration })]);
  const stats = "error" in statsRes ? null : statsRes.data;
  const list = "error" in listRes ? null : listRes.data;
  const pageUrl = (next: number) => {
    const search = new URLSearchParams({ page: String(next), limit: String(limit), hydration });
    if (q.trim()) search.set("q", q.trim());
    return `/dashboard/tv-series?${search}`;
  };
  const statItems = stats ? [
    ["Active series", stats.total], ["Complete", stats.complete], ["Pending", stats.pending],
    ["Imported seasons", stats.seasons], ["Imported episodes", stats.episodes], ["Imported specials", stats.specials],
  ] as const : [];
  return <div>
    <div className={styles.header}>
      <h1 className={styles.title}>{ds.nav.dashboard}</h1>
      <div className={styles.actions}><Link href="/dashboard/profile" className="btnGhost">{ds.nav.profile}</Link>
        <form action={logoutAction}><button type="submit" className="btnGhost">{ds.nav.logOut}</button></form></div>
    </div>
    <DashboardTabs active="tv-series" />
    {stats ? <dl className={tvStyles.stats}>{statItems.map(([label, value]) => <div className={tvStyles.stat} key={label}><dt>{label}</dt><dd>{format(value)}</dd></div>)}</dl>
      : <p className={tvStyles.muted}>TV series stats are unavailable.</p>}
    <section className={styles.section}>
      <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>TV Series</h2></div>
      <form className={tvStyles.filters} action="/dashboard/tv-series">
        <label className={tvStyles.field}>Search<input className="input" type="search" name="q" defaultValue={q} maxLength={140} placeholder="Search series by title..." /></label>
        <label className={tvStyles.field}>Import status<select className="input" name="hydration" defaultValue={hydration}><option value="all">All series</option><option value="complete">Complete</option><option value="pending">Pending</option></select></label>
        <label className={tvStyles.field}>Items per page<select className="input" name="limit" defaultValue={limit}><option value="10">10</option><option value="50">50</option><option value="100">100</option></select></label>
        <button className="btnAccent" type="submit">Search</button>
      </form>
      {!list ? <p className={tvStyles.muted}>Could not load TV series.</p> : list.items.length === 0 ? <p className={styles.empty}>No series match these filters.</p> : <>
        <p className={tvStyles.muted}>{format(list.total)} series</p>
        <ul className={tvStyles.list}>{list.items.map((item) => <li key={item.id} className={tvStyles.row}>
          <div className={tvStyles.info}><Link className={tvStyles.title} href={`/explore/tv-series/${item.id}`}>{item.title}</Link>
            <p className={tvStyles.meta}>{item.hierarchyComplete ? `${format(item.seasonCount!)} seasons · ${format(item.episodeCount!)} episodes · ${format(item.specialCount!)} specials` : "Season and episode import pending"}</p>
            <p className={tvStyles.meta}>Catalog updated {item.fetchedAt.slice(0, 10)}{item.hierarchyUpdatedAt ? ` · Episodes updated ${item.hierarchyUpdatedAt.slice(0, 10)}` : ""}</p>
          </div><a className={tvStyles.source} href={item.sourceUrl} target="_blank" rel="noopener noreferrer">TVmaze ↗</a>
        </li>)}</ul>
        <nav className={tvStyles.pagination} aria-label="TV series pages">
          {page > 1 && <Link href={pageUrl(page - 1)}>← Prev</Link>}
          <span>Page {page} of {Math.max(1, list.totalPages)}</span>
          {page < list.totalPages && <Link href={pageUrl(page + 1)}>Next →</Link>}
        </nav>
      </>}
    </section>
  </div>;
}
