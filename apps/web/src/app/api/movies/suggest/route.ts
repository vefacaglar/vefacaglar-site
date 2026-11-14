import { NextResponse, type NextRequest } from "next/server";
import { getMovieSuggestions, type MovieSuggestions } from "../../../../lib/movies";
import { movieSuggestTerm } from "../../../../lib/movieSearch";

export const dynamic = "force-dynamic";

const EMPTY: MovieSuggestions = { movies: [], people: [] };

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
