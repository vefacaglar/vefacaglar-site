"use client";

import React, { useState, useRef } from "react";
import MarkdownPreview from "./MarkdownPreview";
import styles from "./MarkdownEditor.module.css";
import { getSessionToken } from "../dashboard/actions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const COMPRESS_MAX_DIMENSION = 1000;
const COMPRESS_TARGET_BYTES = 300 * 1024;
const COMPRESS_QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif" || !file.type.startsWith("image/")) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  if (width > COMPRESS_MAX_DIMENSION || height > COMPRESS_MAX_DIMENSION) {
    const ratio = Math.min(COMPRESS_MAX_DIMENSION / width, COMPRESS_MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let bestBlob: Blob | null = null;
  for (const quality of COMPRESS_QUALITIES) {
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );
    if (!blob) continue;
    bestBlob = blob;
    if (blob.size <= COMPRESS_TARGET_BYTES) break;
  }

  if (!bestBlob || bestBlob.size >= file.size) {
    return file;
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([bestBlob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

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
  placeholder = "write in markdown...",
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
        replacement = `\n# ${selectedText || "heading 1"}\n`;
        selectionOffsetStart = 3;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "h2":
        replacement = `\n## ${selectedText || "heading 2"}\n`;
        selectionOffsetStart = 4;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "h3":
        replacement = `\n### ${selectedText || "heading 3"}\n`;
        selectionOffsetStart = 5;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "link":
        replacement = `[${selectedText || "link text"}](https://)`;
        selectionOffsetStart = 1;
        selectionOffsetEnd = (selectedText || "link text").length + 1;
        break;
      case "image":
        replacement = `![${selectedText || "image description"}](/uploads/image.png)`;
        selectionOffsetStart = 2;
        selectionOffsetEnd = (selectedText || "Image Description").length + 2;
        break;
      case "code":
        replacement = `\n\`\`\`\n${selectedText || "code block"}\n\`\`\`\n`;
        selectionOffsetStart = 5;
        selectionOffsetEnd = replacement.length - 5;
        break;
      case "list":
        replacement = `\n- ${selectedText || "list item"}\n`;
        selectionOffsetStart = 3;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "quote":
        replacement = `\n> ${selectedText || "blockquote"}\n`;
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
    const placeholderText = `![uploading ${filename}...]()`;

    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);
    const newValueWithPlaceholder = beforeText + placeholderText + afterText;

    onChange(newValueWithPlaceholder);
    setIsUploading(true);

    try {
      const token = await getSessionToken();
      if (!token) {
        throw new Error("unauthorized. please log in.");
      }

      const compressedFile = await compressImage(file);

      const formData = new FormData();
      formData.append("file", compressedFile);

      const response = await fetch(`${API_URL}/api/uploads/image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || result.error || result.message) {
        throw new Error(result.error || result.message || "failed to upload image.");
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
      alert(error.message || "an error occurred while uploading the image.");

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
            title="bold"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            b
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("italic")}
            title="italic"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            i
          </button>
          <span className={styles.divider}>|</span>
          <button
            type="button"
            onClick={() => insertMarkdown("h1")}
            title="heading 1"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            h1
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("h2")}
            title="heading 2"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            h2
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("h3")}
            title="heading 3"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            h3
          </button>
          <span className={styles.divider}>|</span>
          <button
            type="button"
            onClick={() => insertMarkdown("link")}
            title="insert link"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            link
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("image")}
            title="insert image"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            img
          </button>
          <span className={styles.divider}>|</span>
          <button
            type="button"
            onClick={() => insertMarkdown("list")}
            title="bullet list"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            list
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("quote")}
            title="blockquote"
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            quote
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("code")}
            title="code block"
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
            placeholder={isDragging ? "drop your image here..." : isUploading ? "uploading image..." : placeholder}
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
