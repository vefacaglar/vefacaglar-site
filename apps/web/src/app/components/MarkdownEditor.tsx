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
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertMarkdown = (type: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const scrollTop = textarea.scrollTop;
    const scrollLeft = textarea.scrollLeft;
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
      textarea.focus({ preventScroll: true });
      if (selectedText) {
        textarea.setSelectionRange(start, start + replacement.length);
      } else {
        textarea.setSelectionRange(start + selectionOffsetStart, start + selectionOffsetEnd);
      }
      textarea.scrollTop = scrollTop;
      textarea.scrollLeft = scrollLeft;
    }, 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const imageFile = Array.from(files).find((file) => file.type.startsWith("image/"));
    if (!imageFile) return;

    await uploadImage(imageFile);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    let imageFile: File | null = null;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        imageFile = item.getAsFile();
        break;
      }
    }

    if (imageFile) {
      e.preventDefault();
      await uploadImage(imageFile);
    }
  };

  const uploadImage = async (file: File) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const filename = file.name || "image.png";
    const placeholderText = `![Uploading ${filename}...]()`;

    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);
    const newValueWithPlaceholder = beforeText + placeholderText + afterText;

    onChange(newValueWithPlaceholder);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads/image", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || result.error || result.message) {
        throw new Error(result.error || result.message || "Failed to upload image.");
      }

      const finalImageMarkdown = `![${filename}](${result.url})`;

      const currentVal = textareaRef.current ? textareaRef.current.value : newValueWithPlaceholder;
      const index = currentVal.indexOf(placeholderText);
      if (index !== -1) {
        const updatedVal =
          currentVal.substring(0, index) +
          finalImageMarkdown +
          currentVal.substring(index + placeholderText.length);
        onChange(updatedVal);
      } else {
        onChange(beforeText + finalImageMarkdown + afterText);
      }
    } catch (error: any) {
      console.error("Drag-and-drop upload error:", error);
      alert(error.message || "An error occurred while uploading the image.");

      // Clean up placeholder
      const currentVal = textareaRef.current ? textareaRef.current.value : newValueWithPlaceholder;
      const index = currentVal.indexOf(placeholderText);
      if (index !== -1) {
        const updatedVal =
          currentVal.substring(0, index) +
          currentVal.substring(index + placeholderText.length);
        onChange(updatedVal);
      }
    } finally {
      setIsUploading(false);
    }
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
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onPaste={handlePaste}
            rows={rows}
            placeholder={isDragging ? "Drop your image here..." : isUploading ? "Uploading image..." : placeholder}
            disabled={isUploading}
            className={`${styles.textarea} ${isDragging ? styles.textareaDragActive : ""}`}
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
