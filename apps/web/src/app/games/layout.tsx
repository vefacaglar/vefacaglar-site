import LibraryShell from "../../components/library/LibraryShell";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { libraryMetadata } from "../../lib/librarySeo";

// Library defaults for every /games page, replacing the personal site's branding.
export async function generateMetadata() {
  const dict = getDictionary(await getActiveLanguage());
  return libraryMetadata({ section: "games", description: dict.games_subtitle });
}

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return <LibraryShell section="games">{children}</LibraryShell>;
}
