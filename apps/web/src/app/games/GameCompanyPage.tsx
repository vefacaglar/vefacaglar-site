import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryMasthead from "../../components/library/LibraryMasthead";
import { getActiveLanguage } from "../../lib/lang";
import { localizeHref } from "../../lib/localizeHref";
import { localizedAlternates } from "../../lib/seo";
import { libraryMetadata } from "../../lib/librarySeo";
import { gameCompanyHref, getGameCompany, type GameCompanyRole } from "../../lib/gameCompanies";
import Pagination from "../components/Pagination";
import GameGrid from "./GameGrid";
import styles from "./company.module.css";
import libraryStyles from "./games.module.css";

export async function gameCompanyMetadata(role: GameCompanyRole, slug: string, page: number) {
  const lang = await getActiveLanguage();
  const data = await getGameCompany(role, slug, page);
  if (!data) return {};
  const label = role === "developer" ? "Developer" : "Publisher";
  return libraryMetadata({
    section: "games",
    title: `${data.company.name} · ${label}`,
    description: `${label} ${data.company.name} and its games in this catalog.`,
    alternates: localizedAlternates(gameCompanyHref(role, data.company.slug), lang),
  });
}

export default async function GameCompanyPage({ role, slug, page }: {
  role: GameCompanyRole;
  slug: string;
  page: number;
}) {
  const lang = await getActiveLanguage();
  const data = await getGameCompany(role, slug, page);
  if (!data) notFound();

  const label = role === "developer" ? "Developer" : "Publisher";
  const total = new Intl.NumberFormat(lang).format(data.total);
  const subtitle = `${label} · ${total} ${data.total === 1 ? "game" : "games"} in this catalog`;

  return (
    <div>
      <p className={styles.back}>
        <Link href={localizeHref("/games", lang)}>← Back to games</Link>
      </p>
      <LibraryMasthead title={data.company.name} subtitle={subtitle} />
      {data.items.length > 0 ? (
        <GameGrid games={data.items} lang={lang} />
      ) : (
        <p className={styles.empty}>
          {data.total === 0 ? "No games are available for this company in the catalog yet." : "There are no games on this page."}
          {data.total > 0 && (
            <> <Link href={localizeHref(gameCompanyHref(role, data.company.slug), lang)}>View the first page</Link>.</>
          )}
        </p>
      )}
      <Pagination
        currentPage={data.page}
        totalPages={data.totalPages}
        className={libraryStyles.pagination}
        labels={{ previous: "Previous", next: "Next", pageOf: "Page {current} of {total}" }}
      />
    </div>
  );
}
