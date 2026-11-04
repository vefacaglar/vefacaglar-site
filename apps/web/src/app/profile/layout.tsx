import LibraryShell from "../../components/library/LibraryShell";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { libraryMetadata } from "../../lib/librarySeo";

// Library defaults for every /profile page, so none falls back to the personal site's branding.
export async function generateMetadata() {
  const dict = getDictionary(await getActiveLanguage());
  return libraryMetadata({
    section: "games",
    title: dict.profile,
    description: dict.games_subtitle,
    robots: { index: false },
  });
}

// Profiles are shelves too, so they live inside the library frame.
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <LibraryShell>{children}</LibraryShell>;
}
