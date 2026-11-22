import { NextResponse, type NextRequest } from "next/server";
import { httpClient } from "../../../../lib/httpClient";
import { movieSuggestTerm } from "../../../../lib/movieSearch";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const term = movieSuggestTerm(request.nextUrl.searchParams.get("q"));
  if (!term) return NextResponse.json({ items: [] });
  try {
    const params = new URLSearchParams({ q: term, limit: "8" });
    const response = await httpClient.get(`/api/tv-series?${params}`, { signal: request.signal });
    if (!response.ok) return NextResponse.json({ items: [] }, { status: 502 });
    const data = await response.json();
    return NextResponse.json({ items: data.items }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ items: [] }, { status: 502 });
  }
}
