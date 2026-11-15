import Link from "next/link";
import { getDictionary } from "../../../dictionaries";
import { localizeHref } from "../../../lib/localizeHref";
import { gameCompanyGroupHref, type GameSearchCompany } from "../../../lib/gameSearch";
import styles from "./GameSearchCompanies.module.css";

/** Text-only developer or publisher matches of a games search, one section per group. */
export default function GameSearchCompanies({ group, items, lang }: { group: "developers" | "publishers"; items: GameSearchCompany[]; lang: string }) {
  const dict = getDictionary(lang);
  if (!items.length) return null;
  const title = group === "developers" ? dict.games_search_developers : dict.games_search_publishers;

  const gameCount = (count: number) =>
    count === 1 ? dict.games_search_game_count_one : dict.games_search_game_count.replace("{count}", count.toLocaleString(lang));

  return (
    <section className={styles.companies} aria-labelledby={`games-search-${group}`}>
      <h2 id={`games-search-${group}`} className={styles.heading}>
        {title}
      </h2>
      <ul className={styles.list}>
        {items.map((company) => (
          <li key={company.slug}>
            <Link href={localizeHref(gameCompanyGroupHref(group, company.slug), lang)} className={styles.item}>
              <span className={styles.name}>{company.name}</span>
              <span className={styles.meta}>{gameCount(company.gameCount)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
