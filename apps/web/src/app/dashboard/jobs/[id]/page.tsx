import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import formStyles from "../../components/form.module.css";
import ds from "../../../../lib/dashboard-strings";
import { requireAdmin } from "../../../../lib/session";
import { jobsApi } from "../jobsApi";
import type { JobDetail } from "../types";
import JobLiveView from "./JobLiveView";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetailPage(props: PageProps) {
  const { id } = await props.params;
  const token = (await cookies()).get("session_token")?.value;
  if (!token) redirect("/dashboard/login");
  await requireAdmin();

  const res = await jobsApi<JobDetail>("GET", `/api/jobs/dashboard/${encodeURIComponent(id)}`);

  return (
    <div className={formStyles.wrapper}>
      <div className={formStyles.back}>
        <Link href="/dashboard/jobs" className="backLink">
          {ds.jobs.detail.back}
        </Link>
      </div>

      {res.ok ? (
        <JobLiveView key={res.data.job.id} initial={res.data} serverNow={Date.now()} />
      ) : (
        <p className="errorMsg">{res.status === 404 || res.status === 400 ? ds.jobs.detail.notFound : ds.jobs.detail.loadFailed}</p>
      )}
    </div>
  );
}
