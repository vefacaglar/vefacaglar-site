import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import LibraryMasthead from "../../../../components/library/LibraryMasthead";
import Pagination from "../../../components/Pagination";
import { getPerson, personId, personHref, personCreditHref, personCreditRoles } from "../../../../lib/people";
import { getActiveLanguage } from "../../../../lib/lang";
import { localizeHref } from "../../../../lib/localizeHref";
import { localizedAlternates } from "../../../../lib/seo";
import { libraryMetadata } from "../../../../lib/librarySeo";
import { tvDate, tvPage } from "../../../../lib/tvSeries";
import styles from "./person.module.css";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> };
export async function generateMetadata({ params }: Props) {
  const id = personId((await params).id);
  const [data, lang] = await Promise.all([id ? getPerson(id) : null, getActiveLanguage()]);
  return data ? libraryMetadata({ title: data.person.name, description: `Film and TV series credits of ${data.person.name}.`,
    alternates: localizedAlternates(personHref(data.person.id), lang) }) : {};
}
export default async function PersonProfile({ params, searchParams }: Props) {
  const rawId = (await params).id;
  const id = personId(rawId);
  if (!id) notFound();
  const page = tvPage((await searchParams).page);
  const [data, lang] = await Promise.all([getPerson(id, page), getActiveLanguage()]);
  if (!data) notFound();
  if (data.person.id !== rawId) permanentRedirect(localizeHref(`${personHref(data.person.id)}${page > 1 ? `?page=${page}` : ""}`, lang));
  const { person } = data;
  return <article>
    <Link className={styles.back} href={localizeHref("/explore", lang)}>← Explore</Link>
    <LibraryMasthead title={person.name} subtitle="Film and TV credits" />
    {(person.birthDate || person.deathDate || person.country) && <dl className={styles.facts}>
      {tvDate(person.birthDate) && <div><dt>Born</dt><dd>{tvDate(person.birthDate)}</dd></div>}
      {tvDate(person.deathDate) && <div><dt>Died</dt><dd>{tvDate(person.deathDate)}</dd></div>}
      {person.country && <div><dt>Country</dt><dd>{person.country}</dd></div>}
    </dl>}
    <section aria-labelledby="person-credits">
      <h2 id="person-credits" className={styles.sectionTitle}>Credits in this catalog</h2>
      <ul className={styles.credits}>{data.items.map((credit) => <li key={`${credit.kind}:${credit.id}`}>
        <Link className={styles.credit} href={localizeHref(personCreditHref(credit), lang)}>
          <span className={styles.heading}><span className={styles.title}>{credit.title}</span>{credit.releaseYear !== null && <span className={styles.year}>{credit.releaseYear}</span>}</span>
          <span className={styles.meta}><span className={styles.kind}>{credit.kind === "film" ? "Film" : "TV Series"}</span><span>{personCreditRoles(credit)}</span></span>
        </Link>
      </li>)}</ul>
      <Pagination currentPage={page} totalPages={data.totalPages} className={styles.pagination}
        labels={{ previous: "← Previous", next: "Next →", pageOf: "Page {current} of {total}" }} />
    </section>
    <footer className={styles.sources}>
      {person.wikidataId && <p>Film credits and linked identities from <a href={`https://www.wikidata.org/wiki/${person.wikidataId}`}>Wikidata</a> under CC0.</p>}
      {person.sources.map((source) => <p key={source.provider}>TV credits and person details from <a href={source.sourceUrl}>TVmaze</a> under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA</a>.</p>)}
      <Link href="/credits">Data credits</Link>
    </footer>
  </article>;
}
