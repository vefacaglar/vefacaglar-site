import { NextResponse, type NextRequest } from "next/server";
import { jobsApi } from "../../jobsApi";
import type { JobDetail } from "../../types";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Same-origin proxy for the live job view. The browser polls this route; the
 * admin token stays in its httpOnly cookie and is attached here, server-side.
 * Authorization itself is enforced by the API (requireAdmin).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const afterLogId = request.nextUrl.searchParams.get("afterLogId");
  const qs = afterLogId && /^\d+$/.test(afterLogId) ? `?afterLogId=${afterLogId}` : "";

  const res = await jobsApi<JobDetail>("GET", `/api/jobs/dashboard/${encodeURIComponent(id)}${qs}`);
  if (!res.ok) {
    return NextResponse.json({ message: res.error }, { status: res.status, headers: NO_STORE });
  }
  return NextResponse.json(res.data, { headers: NO_STORE });
}
