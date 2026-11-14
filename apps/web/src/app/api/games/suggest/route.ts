import { NextResponse, type NextRequest } from "next/server";
import { fetchGameSuggestions } from "../../../../lib/gameSearchApi";
import { EMPTY_GAME_SUGGESTIONS } from "../../../../lib/gameSearch";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Same-origin proxy for the games search box suggestions, so the browser never
 * needs the API's address or CORS. The public API endpoint enforces all limits.
 */
export async function GET(request: NextRequest) {
  try {
    const suggestions = await fetchGameSuggestions(request.nextUrl.searchParams.get("q"), request.signal);
    return NextResponse.json(suggestions, { headers: NO_STORE });
  } catch {
    return NextResponse.json(EMPTY_GAME_SUGGESTIONS, { status: 502, headers: NO_STORE });
  }
}
