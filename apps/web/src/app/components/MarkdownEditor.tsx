"use client";

import React, { useState, useRef } from "react";
import MarkdownPreview from "./MarkdownPreview";
import styles from "./MarkdownEditor.module.css";
import { getSessionToken } from "../dashboard/actions";
import e from "../../lib/editor-strings";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
  placeholder = e.placeholders.editor,
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
    const insert = e.insertText;

    switch (type) {
      case "bold":
        replacement = `**${selectedText || insert.bold}**`;
        selectionOffsetStart = 2;
        selectionOffsetEnd = replacement.length - 2;
        break;
      case "italic":
        replacement = `*${selectedText || insert.italic}*`;
        selectionOffsetStart = 1;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "h1":
        replacement = `\n# ${selectedText || insert.heading1}\n`;
        selectionOffsetStart = 3;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "h2":
        replacement = `\n## ${selectedText || insert.heading2}\n`;
        selectionOffsetStart = 4;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "h3":
        replacement = `\n### ${selectedText || insert.heading3}\n`;
        selectionOffsetStart = 5;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "link":
        replacement = `[${selectedText || insert.link}](https://)`;
        selectionOffsetStart = 1;
        selectionOffsetEnd = (selectedText || insert.link).length + 1;
        break;
      case "image":
        replacement = `![${selectedText || insert.image}](/uploads/image.png)`;
        selectionOffsetStart = 2;
        selectionOffsetEnd = (selectedText || insert.image).length + 2;
        break;
      case "code":
        replacement = `\n\`\`\`\n${selectedText || insert.codeBlock}\n\`\`\`\n`;
        selectionOffsetStart = 5;
        selectionOffsetEnd = replacement.length - 5;
        break;
      case "list":
        replacement = `\n- ${selectedText || insert.list}\n`;
        selectionOffsetStart = 3;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case "quote":
        replacement = `\n> ${selectedText || insert.blockquote}\n`;
        selectionOffsetStart = 3;
        selectionOffsetEnd = replacement.length - 1;
        break;
      default:
        return;
    }

    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

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

    const filename = file.name || e.fallbackFilename;
    const placeholderText = e.placeholders.uploadTemplate.replace("{filename}", filename);

    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);
    const newValueWithPlaceholder = beforeText + placeholderText + afterText;

    onChange(newValueWithPlaceholder);
    setIsUploading(true);

    try {
      const token = await getSessionToken();
      if (!token) {
        throw new Error(e.errors.unauthorized);
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
        throw new Error(result.error || result.message || e.errors.uploadFailed);
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
      alert(error.message || e.errors.unexpected);

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

  const { toolbar, tooltips, tabs, placeholders } = e;

  return (
    <div className={styles.editorContainer}>
      <div className={styles.tabBar}>
        <div className={`${styles.toolbar} ${activeTab === "preview" ? styles.toolbarDisabled : ""}`}>
          <button
            type="button"
            onClick={() => insertMarkdown("bold")}
            title={tooltips.bold}
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            {toolbar.bold}
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("italic")}
            title={tooltips.italic}
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            {toolbar.italic}
          </button>
          <span className={styles.divider}>{e.divider}</span>
          <button
            type="button"
            onClick={() => insertMarkdown("h1")}
            title={tooltips.heading1}
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            {toolbar.heading1}
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("h2")}
            title={tooltips.heading2}
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            {toolbar.heading2}
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("h3")}
            title={tooltips.heading3}
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            {toolbar.heading3}
          </button>
          <span className={styles.divider}>{e.divider}</span>
          <button
            type="button"
            onClick={() => insertMarkdown("link")}
            title={tooltips.insertLink}
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            {toolbar.link}
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("image")}
            title={tooltips.insertImage}
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            {toolbar.image}
          </button>
          <span className={styles.divider}>{e.divider}</span>
          <button
            type="button"
            onClick={() => insertMarkdown("list")}
            title={tooltips.bulletList}
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            {toolbar.list}
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("quote")}
            title={tooltips.blockquote}
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            {toolbar.quote}
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("code")}
            title={tooltips.codeBlock}
            disabled={activeTab === "preview"}
            className={styles.toolbarBtn}
          >
            {toolbar.codeBlock}
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={activeTab === "edit" ? styles.tabActive : styles.tabInactive}
          >
            {tabs.write}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={activeTab === "preview" ? styles.tabActive : styles.tabInactive}
          >
            {tabs.preview}
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
            placeholder={isDragging ? placeholders.dragImage : isUploading ? placeholders.uploading : placeholder}
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
