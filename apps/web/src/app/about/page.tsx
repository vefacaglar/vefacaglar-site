import Link from 'next/link';
import BackButton from "../components/BackButton";
import MarkdownPreview from "../components/MarkdownPreview";
import styles from "./about.module.css";
import { httpClient } from "../../lib/httpClient";

interface PageItem {
  id: string;
  slug: string;
  title: string;
  content: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  let page: PageItem | null = null;

  try {
    const res = await httpClient.get("/api/pages/about", {
      cache: "no-store",
    });
    if (res.ok) {
      page = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch about page metadata:", error);
  }

  return {
    title: page?.seoTitle || page?.title || "About",
    description: page?.seoDescription || "About Vefa Çağlar",
  };
}

export default async function About() {
  let page: PageItem | null = null;

  try {
    const pageRes = await httpClient.get("/api/pages/about", {
      cache: "no-store",
    });
    if (pageRes.ok) {
      page = await pageRes.json();
    }
  } catch (error) {
    console.error("Failed to fetch about page:", error);
  }

  return (
    <div>
      <div className={styles.back}>
        <BackButton />
      </div>
      <h1>{page?.title || "About"}</h1>
      {page?.content && (
        <MarkdownPreview content={page.content} />
      )}
    </div>
  );
}
