import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction } from "../actions";
import dashStyles from "../dashboard.module.css";
import styles from "./jobs.module.css";
import ds from "../../../lib/dashboard-strings";
import { requireAdmin } from "../../../lib/session";
import { jobsApi } from "./jobsApi";
import { countJobs, listJobs } from "./jobsQueries";
import { JOB_FILTERS, isActiveStatus, isJobFilter, type JobFilter, type RecurringJob, type Worker } from "./types";
import WorkerStatus from "./components/WorkerStatus";
import JobsTable from "./components/JobsTable";
import JobsPagination from "./components/JobsPagination";
import RegisteredJobs from "./components/RegisteredJobs";
import AutoRefresh from "./components/AutoRefresh";

export const dynamic = "force-dynamic";

type Tab = "jobs" | "registered";

interface PageProps {
  searchParams: Promise<{ tab?: string; status?: string; recurringJobId?: string; page?: string; limit?: string }>;
}

function jobsHref(params: { tab?: Tab; status?: JobFilter | null; recurringJobId?: string | null; limit?: number }) {
  const q = new URLSearchParams();
  if (params.tab === "registered") q.set("tab", "registered");
  if (params.status) q.set("status", params.status);
  if (params.recurringJobId) q.set("recurringJobId", params.recurringJobId);
  if (params.limit && params.limit !== 10) q.set("limit", String(params.limit));
  const qs = q.toString();
  return qs ? `/dashboard/jobs?${qs}` : "/dashboard/jobs";
}

function Chip({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number | null }) {
  return (
    <Link href={href} className={active ? styles.chipActive : styles.chip} aria-current={active ? "page" : undefined}>
      {label}
      {typeof count === "number" && <span className={styles.chipCount}>{count.toLocaleString("en-GB")}</span>}
    </Link>
  );
}

export default async function JobsDashboard(props: PageProps) {
  const searchParams = await props.searchParams;
  const token = (await cookies()).get("session_token")?.value;
  if (!token) redirect("/dashboard/login");
  await requireAdmin();

  const tab: Tab = searchParams.tab === "registered" ? "registered" : "jobs";
  const now = Date.now();
  const workersPromise = jobsApi<{ items: Worker[] }>("GET", "/api/jobs/dashboard/workers");

  let body: React.ReactNode;
  let autoRefresh: { active: boolean; intervalMs: number };

  if (tab === "registered") {
    const recurringRes = await jobsApi<{ items: RecurringJob[] }>("GET", "/api/jobs/dashboard/recurring");
    // Runs started elsewhere (another tab, the API) show up on the next quiet refresh;
    // runs started here stream live inside their card.
    autoRefresh = { active: recurringRes.ok, intervalMs: 15000 };
    body = recurringRes.ok ? (
      <RegisteredJobs items={recurringRes.data.items ?? []} now={now} />
    ) : (
      <p className="errorMsg">{ds.jobs.registered.loadFailed}</p>
    );
  } else {
    const status = isJobFilter(searchParams.status) ? searchParams.status : null;
    const recurringJobId = searchParams.recurringJobId?.trim() || null;
    const page = Math.max(1, Number(searchParams.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.limit) || 10));

    const [jobsRes, ...counts] = await Promise.all([
      listJobs({ filter: status, page, limit, recurringJobId }),
      ...JOB_FILTERS.map((f) => countJobs(f, recurringJobId)),
    ]);
    const countBy = Object.fromEntries(JOB_FILTERS.map((f, i) => [f, counts[i]])) as Record<JobFilter, number | null>;
    const allCount = counts.every((c) => typeof c === "number")
      ? (counts as number[]).reduce((a, b) => a + b, 0)
      : null;

    const jobs = jobsRes.ok ? jobsRes.data.items ?? [] : [];
    const total = jobsRes.ok ? jobsRes.data.total ?? 0 : 0;
    autoRefresh = {
      active: jobs.some((j) => isActiveStatus(j.status)) || (countBy.processing ?? 0) > 0,
      intervalMs: 4000,
    };

    const pageFilters: Record<string, string> = {};
    if (status) pageFilters.status = status;
    if (recurringJobId) pageFilters.recurringJobId = recurringJobId;

    body = (
      <>
        <div className={styles.filterBar}>
          <nav className={styles.filters} aria-label={ds.jobs.filters.label}>
            {JOB_FILTERS.map((f) => (
              <Chip
                key={f}
                href={jobsHref({ status: f, recurringJobId, limit })}
                active={status === f}
                label={ds.jobs.filters[f]}
                count={countBy[f]}
              />
            ))}
            <Chip
              href={jobsHref({ recurringJobId, limit })}
              active={status === null}
              label={ds.jobs.filters.all}
              count={allCount}
            />
          </nav>
          {recurringJobId && (
            <p className={styles.scope}>
              {ds.jobs.list.filteredBy.replace("{id}", recurringJobId)}{" "}
              <Link href={jobsHref({ status, limit })}>{ds.jobs.list.clearFilter}</Link>
            </p>
          )}
        </div>

        {!jobsRes.ok ? (
          <p className="errorMsg">{ds.jobs.list.loadFailed}</p>
        ) : jobs.length === 0 ? (
          <p className={styles.empty}>
            {status ? ds.jobs.list.emptyFiltered.replace("{status}", ds.jobs.filters[status]) : ds.jobs.list.empty}
          </p>
        ) : (
          <>
            <JobsTable jobs={jobs} now={now} />
            {total > 10 && <JobsPagination page={page} limit={limit} total={total} filters={pageFilters} />}
          </>
        )}
      </>
    );
  }

  const workersRes = await workersPromise;
  const workers = workersRes.ok ? workersRes.data.items ?? [] : null;

  return (
    <div>
      <div className={dashStyles.header}>
        <h1 className={dashStyles.title}>{ds.nav.dashboard}</h1>
        <div className={dashStyles.actions}>
          <Link href="/dashboard/profile" className="btnGhost">
            {ds.nav.profile}
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btnGhost">
              {ds.nav.logOut}
            </button>
          </form>
        </div>
      </div>

      <div className={dashStyles.tabsContainer}>
        <Link href="/dashboard" className={dashStyles.tab}>
          {ds.nav.tabs.content}
        </Link>
        <Link href="/dashboard/packages" className={dashStyles.tab}>
          {ds.nav.tabs.packages}
        </Link>
        <Link href="/dashboard/games" className={dashStyles.tab}>
          {ds.nav.tabs.games}
        </Link>
        <Link href="/dashboard/jobs" className={`${dashStyles.tab} ${dashStyles.activeTab}`}>
          {ds.nav.tabs.jobs}
        </Link>
      </div>

      <AutoRefresh active={autoRefresh.active} intervalMs={autoRefresh.intervalMs} />

      <div className={styles.topBar}>
        <nav className={styles.viewTabs} aria-label={ds.nav.tabs.jobs}>
          <Link
            href={jobsHref({ tab: "jobs" })}
            className={tab === "jobs" ? styles.viewTabActive : styles.viewTab}
            aria-current={tab === "jobs" ? "page" : undefined}
          >
            {ds.jobs.tabs.runs}
          </Link>
          <Link
            href={jobsHref({ tab: "registered" })}
            className={tab === "registered" ? styles.viewTabActive : styles.viewTab}
            aria-current={tab === "registered" ? "page" : undefined}
          >
            {ds.jobs.tabs.registered}
          </Link>
        </nav>
        <WorkerStatus workers={workers} now={now} />
      </div>

      <section className={dashStyles.section}>{body}</section>
    </div>
  );
}
