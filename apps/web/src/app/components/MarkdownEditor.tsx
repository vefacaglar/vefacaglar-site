"use client";

import React, { useState, useRef } from "react";
import MarkdownPreview from "./MarkdownPreview";
import styles from "./MarkdownEditor.module.css";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write in Markdown...",
  required = false,
  rows = 15,
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = (type: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let replacement = "";
    let selectionOffsetStart = 0;
    let selectionOffsetEnd = 0;

    switch (type) {
      case "bold":
        replacement = `**${selectedText || "bold text"}**`;
        selectionOffsetStart = 2;
        selectionOffsetEnd = replacement.length - 2;
        break;
      case "italic":
        replacement = `*${selectedText || "italic text"}*`;
        selectionOffsetStart = 1;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "h1":
        replacement = `\n# ${selectedText || "Heading 1"}\n`;
        selectionOffsetStart = 3;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "h2":
        replacement = `\n## ${selectedText || "Heading 2"}\n`;
        selectionOffsetStart = 4;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "h3":
        replacement = `\n### ${selectedText || "Heading 3"}\n`;
        selectionOffsetStart = 5;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "link":
        replacement = `[${selectedText || "Link Text"}](https://)`;
        selectionOffsetStart = 1;
        selectionOffsetEnd = (selectedText || "Link Text").length + 1;
        break;
      case "image":
        replacement = `![${selectedText || "Image Description"}](/uploads/image.png)`;
        selectionOffsetStart = 2;
        selectionOffsetEnd = (selectedText || "Image Description").length + 2;
        break;
      case "code":
        replacement = `\n\`\`\`\n${selectedText || "code block"}\n\`\`\`\n`;
        selectionOffsetStart = 5;
        selectionOffsetEnd = replacement.length - 5;
        break;
      case "list":
        replacement = `\n- ${selectedText || "List item"}\n`;
        selectionOffsetStart = 3;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "quote":
        replacement = `\n> ${selectedText || "Blockquote"}\n`;
        selectionOffsetStart = 3;
        selectionOffsetEnd = replacement.length - 1;
        break;
      default:
        return;
    }

    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    // Wait for React to apply onChange state update, then restore focus & select
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start, start + replacement.length);
      } else {
        textarea.setSelectionRange(start + selectionOffsetStart, start + selectionOffsetEnd);
      }
    }, 0);
  };

  return (
    <div className={styles.editorContainer}>
      <div className={styles.tabBar}>
        <div className={`${styles.toolbar} ${activeTab === "preview" ? styles.toolbarDisabled : ""}`}>
          <button
            type="button"
            onClick={() => insertMarkdown("bold")}
            title="Bold"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            b
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("italic")}
            title="Italic"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            i
          </button>
          <span className={styles.divider}>|</span>
          <button
            type="button"
            onClick={() => insertMarkdown("h1")}
            title="Heading 1"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            h1
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("h2")}
            title="Heading 2"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            h2
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("h3")}
            title="Heading 3"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            h3
          </button>
          <span className={styles.divider}>|</span>
          <button
            type="button"
            onClick={() => insertMarkdown("link")}
            title="Insert Link"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            link
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("image")}
            title="Insert Image"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            img
          </button>
          <span className={styles.divider}>|</span>
          <button
            type="button"
            onClick={() => insertMarkdown("list")}
            title="Bullet List"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            list
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("quote")}
            title="Blockquote"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            quote
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("code")}
            title="Code Block"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            code
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={activeTab === "edit" ? styles.tabActive : styles.tabInactive}
          >
            write
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={activeTab === "preview" ? styles.tabActive : styles.tabInactive}
          >
            preview
          </button>
        </div>
      </div>

      <div className={styles.editorBody}>
        {activeTab === "edit" ? (
          <textarea
            ref={textareaRef}
            required={required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            placeholder={placeholder}
            className={styles.textarea}
          />
        ) : (
          <div className={styles.preview}>
            <MarkdownPreview content={value} />
          </div>
        )}
      </div>
    </div>
  );
}
