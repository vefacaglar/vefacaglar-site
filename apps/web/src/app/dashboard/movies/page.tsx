import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logoutAction } from "../actions";
import styles from "../dashboard.module.css";
import ds from "../../../lib/dashboard-strings";
import DashboardTabs from "../components/DashboardTabs";
import { requireAdmin } from "../../../lib/session";
import MoviesDashboardClient from "./MoviesDashboardClient";
import MovieStatsRow from "./MovieStatsRow";
import { getMovieStatsAction, listDashboardMoviesAction } from "./actions";

export const dynamic = "force-dynamic";

const LIMITS = [10, 50, 100];
const DEFAULT_LIMIT = 50;

interface PageProps {
  searchParams: Promise<{ page?: string; limit?: string; q?: string; blocked?: string }>;
}

export default async function MoviesDashboard(props: PageProps) {
  const searchParams = await props.searchParams;
  const token = (await cookies()).get("session_token")?.value;
  if (!token) redirect("/dashboard/login");
  await requireAdmin();

  const page = Math.max(1, Math.floor(Number(searchParams.page)) || 1);
  const limit = LIMITS.includes(Number(searchParams.limit)) ? Number(searchParams.limit) : DEFAULT_LIMIT;
  const q = (searchParams.q ?? "").slice(0, 140);
  const blocked = searchParams.blocked === "1";

  const [statsRes, listRes] = await Promise.all([getMovieStatsAction(), listDashboardMoviesAction({ page, limit, q, blocked })]);
  const stats = "error" in statsRes ? null : statsRes.data;
  const list = "error" in listRes ? null : listRes.data;

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>{ds.nav.dashboard}</h1>
        <div className={styles.actions}>
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

      <DashboardTabs active="movies" />

      <MovieStatsRow stats={stats} />

      <MoviesDashboardClient
        items={list?.items ?? []}
        total={list?.total ?? 0}
        totalPages={list?.totalPages ?? 0}
        page={page}
        limit={limit}
        q={q}
        blocked={blocked}
        loadFailed={list === null}
      />
    </div>
  );
}
