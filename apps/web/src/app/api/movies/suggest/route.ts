import { NextResponse, type NextRequest } from "next/server";
import { getMovieSuggestions } from "../../../../lib/movies";
import { EMPTY_MOVIE_SUGGESTIONS as EMPTY, movieSuggestTerm } from "../../../../lib/movieSearch";

export const dynamic = "force-dynamic";

/** Browser-facing typeahead proxy; the API base URL stays server-only. */
export async function GET(request: NextRequest) {
  const term = movieSuggestTerm(request.nextUrl.searchParams.get("q"));
  if (!term) return NextResponse.json(EMPTY);
  try {
    const data = await getMovieSuggestions(term, { signal: request.signal });
    return NextResponse.json(data ?? EMPTY, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json(EMPTY, { status: 502 });
  }
}
