import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { httpClient } from "../../../../../../../lib/httpClient";

const ALLOWED_RELATION_TYPES = new Set([
  "developers",
  "publishers",
  "genres",
  "platforms",
  "themes",
]);

type RouteContext = {
  params: { id: string; relationType: string; relationId: string };
};

async function proxy(
  method: "POST" | "DELETE",
  { params }: RouteContext
): Promise<NextResponse> {
  const { id, relationType, relationId } = params;

  if (!ALLOWED_RELATION_TYPES.has(relationType)) {
    return NextResponse.json({ message: "Invalid relation type." }, { status: 400 });
  }

  const token = cookies().get("session_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const path = `/api/games/games/${id}/${relationType}/${relationId}`;
  const headers = { Authorization: `Bearer ${token}` };

  const apiRes =
    method === "POST"
      ? await httpClient.post(path, undefined, { headers })
      : await httpClient.delete(path, { headers });

  const body = await apiRes.text();
  return new NextResponse(body, {
    status: apiRes.status,
    headers: { "Content-Type": apiRes.headers.get("Content-Type") || "application/json" },
  });
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  return proxy("POST", ctx);
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  return proxy("DELETE", ctx);
}
