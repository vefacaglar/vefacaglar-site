import MarkdownPreview from "../components/MarkdownPreview";
import styles from "./about.module.css";
import { getActiveLanguage } from "../../lib/lang";
import { getDictionary } from "../../dictionaries";
import { localizedAlternates } from "../../lib/seo";
import AdminEditLink from "../../components/AdminEditLink";
import { localizeHref } from "../../lib/localizeHref";
import { getPage } from "../../lib/data";

export const revalidate = 3600;

export async function generateMetadata() {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const page = await getPage("about");

  return {
    title: page?.seoTitle || page?.title || dict.about,
    description: page?.seoDescription || dict.about_meta_description,
    alternates: localizedAlternates("/about", lang),
  };
}

export default async function About() {
  const lang = getActiveLanguage();
  const dict = getDictionary(lang);
  const page = await getPage("about");

  return (
    <div>
      <h1>{page?.title || dict.about}</h1>
      {page?.content && (
        <MarkdownPreview content={page.content} />
      )}
      {page?.id && (
        <AdminEditLink type="page" id={page.id} from={localizeHref("/about", lang)} />
      )}
    </div>
  );
}
