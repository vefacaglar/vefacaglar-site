import LibraryShell from "../../components/library/LibraryShell";
import { libraryMetadata } from "../../lib/librarySeo";

export const metadata = libraryMetadata({ description: "Discover games and movies." });

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <LibraryShell>{children}</LibraryShell>;
}
