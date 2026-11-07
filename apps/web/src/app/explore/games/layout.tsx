import { getActiveLanguage } from "../../../lib/lang";
import { getDictionary } from "../../../dictionaries";
import { libraryMetadata } from "../../../lib/librarySeo";

// Section metadata inherits the shared Explore frame.
export async function generateMetadata() {
  const dict = getDictionary(await getActiveLanguage());
  return libraryMetadata({ section: "games", description: dict.games_subtitle });
}

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
