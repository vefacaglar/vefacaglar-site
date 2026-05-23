import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { httpClient } from "../../../../../lib/httpClient";

type RouteContext = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const token = cookies().get("session_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const apiRes = await httpClient.get(`/api/games/games/${params.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await apiRes.text();
  return new NextResponse(body, {
    status: apiRes.status,
    headers: { "Content-Type": apiRes.headers.get("Content-Type") || "application/json" },
  });
}
