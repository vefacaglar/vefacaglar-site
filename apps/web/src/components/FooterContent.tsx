"use client";

import React from "react";
import Link from "next/link";
import { useLocale } from "./LocaleProvider";
import { localizeHref } from "../lib/localizeHref";

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("?") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:")
  );
}

function renderLinks(text: string, locale: "en" | "tr", index: number): React.ReactNode {
  const regex = /\[(.*?)\]\((.*?)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let k = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`${index}-${k++}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    const label = match[1];
    const href = match[2];
    if (!isSafeUrl(href)) {
      parts.push(<span key={`${index}-${k++}`}>{label}</span>);
    } else if (/^https?:\/\//i.test(href.trim())) {
      parts.push(
        <a key={`${index}-${k++}`} href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      );
    } else if (href.startsWith("/")) {
      parts.push(
        <Link key={`${index}-${k++}`} href={localizeHref(href, locale)}>
          {label}
        </Link>
      );
    } else {
      parts.push(
        <a key={`${index}-${k++}`} href={href}>
          {label}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`${index}-${k++}`}>{text.slice(lastIndex)}</span>);
  }
  return <React.Fragment key={index}>{parts}</React.Fragment>;
}

function renderInline(text: string, locale: "en" | "tr"): React.ReactNode {
  return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length >= 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      renderLinks(part, locale, i)
    )
  );
}

/**
 * Renders short footer markdown (bold + safe links) as one <p> per non-empty line.
 * No raw HTML is ever injected.
 */
export default function FooterContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const locale = useLocale();
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <>
      {lines.map((line, i) => (
        <p key={i} className={className}>
          {renderInline(line, locale)}
        </p>
      ))}
    </>
  );
}
