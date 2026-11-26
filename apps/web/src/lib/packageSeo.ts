import { safeExternalUrl } from "./safeExternalUrl";

export type PackageDocsTarget = {
  href: string;
  external: boolean;
};

type PackageDocsInput = {
  slug: string;
  docs?: string | null;
  docsList?: Array<{ slug: string; displayOrder: number }> | null;
};

/**
 * Resolve the canonical documentation URL for a package group, avoiding the
 * `/packages/[slug]/docs` redirect route in internal links.
 */
export function resolvePackageDocsHref(pkg: PackageDocsInput | null | undefined): PackageDocsTarget | null {
  if (!pkg) return null;

  const docsList = pkg.docsList ?? [];

  if (pkg.docs && !pkg.docs.startsWith("http") && !pkg.docs.includes("/")) {
    const hasDoc = docsList.some((doc) => doc.slug === pkg.docs);
    if (hasDoc) {
      return { href: `/packages/${pkg.slug}/docs/${pkg.docs}`, external: false };
    }
  }

  if (docsList.length > 0) {
    const sortedDocs = [...docsList].sort((a, b) => a.displayOrder - b.displayOrder);
    return { href: `/packages/${pkg.slug}/docs/${sortedDocs[0].slug}`, external: false };
  }

  const externalDocs = safeExternalUrl(pkg.docs);
  if (externalDocs) {
    return { href: externalDocs, external: true };
  }

  return null;
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract a clean plain-text summary from the first prose paragraph of a
 * markdown document, suitable for meta descriptions when no explicit summary
 * is set in the database.
 */
export function extractMarkdownSummary(markdown: string | null | undefined, maxLength = 160): string | null {
  if (!markdown) return null;

  const lines = markdown.split(/\r?\n/);
  const paragraphLines: string[] = [];
  let inCodeFence = false;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      if (paragraphLines.length > 0) break;
      continue;
    }
    if (inCodeFence) continue;

    if (trimmed === "") {
      if (paragraphLines.length > 0) break;
      continue;
    }

    // Skip headings, tables, horizontal rules, list items, and standalone code lines
    if (
      /^#{1,6}\s/.test(trimmed) ||
      trimmed.startsWith("|") ||
      /^[-*_]{3,}$/.test(trimmed) ||
      /^[-*+]\s/.test(trimmed) ||
      /^\d+\.\s/.test(trimmed) ||
      (trimmed.startsWith("`") && trimmed.endsWith("`"))
    ) {
      if (paragraphLines.length > 0) break;
      continue;
    }

    const cleaned = stripInlineMarkdown(trimmed.replace(/^>\s*/, ""));
    if (cleaned) {
      paragraphLines.push(cleaned);
    }
  }

  const summary = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
  if (!summary) return null;

  if (summary.length <= maxLength) return summary;

  const slice = summary.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > Math.floor(maxLength * 0.6) ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[.,;:!?-]+$/, "")}…`;
}

export function resolvePackageDescription(
  description: string | null | undefined,
  content: string | null | undefined,
  fallback: string
): string {
  const explicit = description?.trim();
  if (explicit) return explicit;
  return extractMarkdownSummary(content) ?? fallback;
}

/**
 * Strip a leading `# Title` line when it repeats the page's rendered `<h1>`.
 */
export function stripLeadingDuplicateHeading(content: string, pageTitle: string): string {
  const normalizedTitle = pageTitle.trim().toLowerCase();
  if (!normalizedTitle) return content;

  const lines = content.split(/\r?\n/);
  let firstNonEmpty = 0;
  while (firstNonEmpty < lines.length && lines[firstNonEmpty].trim() === "") {
    firstNonEmpty++;
  }

  if (firstNonEmpty >= lines.length) return content;

  const firstLine = lines[firstNonEmpty].trim();
  if (firstLine.startsWith("# ")) {
    const headingText = stripInlineMarkdown(firstLine.slice(2)).toLowerCase();
    if (headingText === normalizedTitle) {
      return lines.slice(firstNonEmpty + 1).join("\n").replace(/^\s*\n/, "");
    }
  }

  return content;
}
