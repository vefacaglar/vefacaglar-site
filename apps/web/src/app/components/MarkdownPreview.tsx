import React from "react";

interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  if (!content.trim()) {
    return <span style={{ color: "var(--muted)" }}>No content written yet.</span>;
  }

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key++}`} style={{ margin: "0 0 12px 0", paddingLeft: "20px" }}>
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const renderInline = (text: string): React.ReactNode => {
    // Bold: **text**
    let parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      // Italic: *text* (but not **)
      let subParts = part.split(/(?<!\*)\*(?!\*).*?(?<!\*)\*(?!\*)/g);
      // Actually simpler approach for italic
      return renderLinks(part, i);
    });
  };

  const renderLinks = (text: string, index: number): React.ReactNode => {
    const linkRegex = /\[(.*?)\]\((.*?)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let keyCounter = 0;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`${index}-${keyCounter++}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      parts.push(
        <a key={`${index}-${keyCounter++}`} href={match[2]} style={{ color: "var(--accent)", textDecoration: "underline" }}>
          {match[1]}
        </a>
      );
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

    // Heading 1
    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={key++} style={{ margin: "16px 0 8px 0", fontSize: "24px" }}>
          {renderInline(trimmed.slice(2))}
        </h1>
      );
      continue;
    }

    // Heading 2
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h2 key={key++} style={{ margin: "16px 0 8px 0", fontSize: "20px" }}>
          {renderInline(trimmed.slice(3))}
        </h2>
      );
      continue;
    }

    // Heading 3
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h3 key={key++} style={{ margin: "12px 0 6px 0", fontSize: "18px" }}>
          {renderInline(trimmed.slice(4))}
        </h3>
      );
      continue;
    }

    // List items
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      flushList();
      elements.push(
        <blockquote
          key={key++}
          style={{
            margin: "0 0 12px 0",
            paddingLeft: "16px",
            borderLeft: "3px solid var(--muted)",
            color: "var(--muted)",
            fontStyle: "italic",
          }}
        >
          {renderInline(trimmed.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Code block
    if (trimmed.startsWith("```")) {
      flushList();
      const lang = trimmed.slice(3).trim();
      i++; // skip the ``` line
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre
          key={key++}
          style={{
            background: "var(--border)",
            padding: "12px",
            borderRadius: "4px",
            overflowX: "auto",
            fontSize: "13px",
            margin: "0 0 12px 0",
          }}
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Inline code
    if (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length > 2) {
      flushList();
      elements.push(
        <p key={key++} style={{ margin: "0 0 8px 0" }}>
          <code
            style={{
              background: "var(--border)",
              padding: "2px 4px",
              borderRadius: "3px",
              fontSize: "13px",
            }}
          >
            {trimmed.slice(1, -1)}
          </code>
        </p>
      );
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={key++} style={{ margin: "0 0 8px 0" }}>
        {renderInline(trimmed)}
      </p>
    );
  }

  flushList();

  return <div style={{ opacity: 0.9 }}>{elements}</div>;
}
