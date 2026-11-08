import { unstable_rethrow } from "next/navigation";
import { getMovieLibrary, type MovieLibrary } from "../../lib/movieActivity";

/** Keep the rest of a profile available if its movie library cannot be loaded. */
export async function getProfileMovieLibrary(username: string): Promise<MovieLibrary | null> {
  try {
    const result = await getMovieLibrary(username);
    return result.kind === "ok" ? result.data : null;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
