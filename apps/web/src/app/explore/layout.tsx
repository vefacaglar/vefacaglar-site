import LibraryShell from "../../components/library/LibraryShell";
import { libraryMetadata } from "../../lib/librarySeo";

export const metadata = libraryMetadata({ description: "Discover games, movies, and TV series." });

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <LibraryShell>{children}</LibraryShell>;
}
