import LibraryShell from "../../components/library/LibraryShell";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { libraryMetadata } from "../../lib/librarySeo";

// Library defaults for every /movies page, replacing the personal site's branding.
export async function generateMetadata() {
  const dict = getDictionary(await getActiveLanguage());
  return libraryMetadata({ section: "movies", description: dict.movies_subtitle });
}

export default function MoviesLayout({ children }: { children: React.ReactNode }) {
  return <LibraryShell section="movies">{children}</LibraryShell>;
}
