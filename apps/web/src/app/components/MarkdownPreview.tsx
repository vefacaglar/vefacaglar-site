"use client";

import React from "react";
import Link from "next/link";
import styles from "./MarkdownPreview.module.css";

interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const [activeImage, setActiveImage] = React.useState<{ src: string; alt: string } | null>(null);

  React.useEffect(() => {
    if (!activeImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeImage]);

  if (!content.trim()) {
    return <span className={styles.empty}>No content written yet.</span>;
  }

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key++}`} className={styles.list}>
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (text: string): React.ReactNode => {
    let parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return renderLinks(part, i);
    });
  };

  const isSafeUrl = (url: string): boolean => {
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) return true;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return true;
    if (trimmed.startsWith("mailto:")) return true;
    return false;
  };

  const renderLinks = (text: string, index: number): React.ReactNode => {
    const combinedRegex = /(!)?\[(.*?)\]\((.*?)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let keyCounter = 0;

    while ((match = combinedRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`${index}-${keyCounter++}`}>{text.slice(lastIndex, match.index)}</span>);
      }

      const isImage = match[1] === "!";
      const altText = match[2];
      const srcOrHref = match[3];

      if (!isSafeUrl(srcOrHref)) {
        parts.push(<span key={`${index}-${keyCounter++}`}>{altText}</span>);
        lastIndex = match.index + match[0].length;
        continue;
      }

      if (isImage) {
        parts.push(
          <img
            key={`${index}-${keyCounter++}`}
            src={srcOrHref}
            alt={altText}
            className={styles.image}
            onClick={() => setActiveImage({ src: srcOrHref, alt: altText })}
          />
        );
      } else {
        const isExternal = srcOrHref.startsWith("http://") || srcOrHref.startsWith("https://");
        parts.push(
          isExternal ? (
            <a
              key={`${index}-${keyCounter++}`}
              href={srcOrHref}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              {altText}
            </a>
          ) : (
            <Link
              key={`${index}-${keyCounter++}`}
              href={srcOrHref}
              className={styles.link}
            >
              {altText}
            </Link>
          )
        );
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={`${index}-${keyCounter++}`}>{text.slice(lastIndex)}</span>);
    }

    if (parts.length === 0) {
      return <span key={index}>{text}</span>;
    }

    return <React.Fragment key={index}>{parts}</React.Fragment>;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      flushList();
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={key++} className={styles.h1}>
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={key++} className={styles.h2}>
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={key++} className={styles.h3}>
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote key={key++} className={styles.blockquote}>
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushList();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key++} className={styles.codeBlock}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    if (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length > 2) {
      flushList();
      elements.push(
        <p key={key++} className={styles.paragraph}>
          <code className={styles.inlineCode}>
            {trimmed.slice(1, -1)}
          </code>
        </p>
      );
      continue;
    }

    flushList();
    elements.push(
      <p key={key++} className={styles.paragraph}>
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();

  return (
    <div className={styles.wrapper}>
      {elements}
      {activeImage && (
        <div className={styles.lightboxOverlay} onClick={() => setActiveImage(null)}>
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button 
              className={styles.lightboxCloseButton} 
              onClick={() => setActiveImage(null)}
              aria-label="Close image lightbox"
            >
              &times;
            </button>
            <img 
              src={activeImage.src} 
              alt={activeImage.alt} 
              className={styles.lightboxImage} 
            />
            {activeImage.alt && (
              <div className={styles.lightboxCaption}>{activeImage.alt}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
