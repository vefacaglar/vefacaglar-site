"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../../../dashboard.module.css";
import formStyles from "../../../components/form.module.css";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  deleteDocAction
} from "../../actions";
import { useConfirm } from "../../../components/ConfirmProvider";

interface CategoryItem {
  id: string;
  title: string;
  slug: string;
  displayOrder: number;
}

interface DocItem {
  id: string;
  categoryId?: string | null;
  slug: string;
  title: string;
  filePath: string;
  displayOrder: number;
  isPublished: boolean;
}

interface DocManagementProps {
  packageId: string;
  groupSlug?: string;
  categories: CategoryItem[];
  docs: DocItem[];
}

export default function DocManagement({ packageId, groupSlug, categories, docs }: DocManagementProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirm();

  // Tab state: 'docs' | 'categories'
  const [subTab, setSubTab] = useState<"docs" | "categories">("docs");

  // Inline category creation form state
  const [newCatTitle, setNewCatTitle] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");
  const [newCatOrder, setNewCatOrder] = useState<number>(0);
  const [catError, setCatError] = useState<string | null>(null);
  const [catLoading, setCatLoading] = useState(false);

  // Inline category editing state
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatTitle, setEditCatTitle] = useState("");
  const [editCatSlug, setEditCatSlug] = useState("");
  const [editCatOrder, setEditCatOrder] = useState<number>(0);

  const slugify = (text: string) => {
    const trMap: Record<string, string> = {
      'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'I': 'i', 'İ': 'i',
      'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
    };
    let slugged = text;
    for (const key in trMap) {
      slugged = slugged.replace(new RegExp(key, 'g'), trMap[key]);
    }
    return slugged
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "");
  };

  // Auto-slugify new category title
  const handleNewTitleChange = (val: string) => {
    setNewCatTitle(val);
    setNewCatSlug(slugify(val));
  };

  // Auto-slugify editing category title
  const handleEditTitleChange = (val: string) => {
    setEditCatTitle(val);
    setEditCatSlug(slugify(val));
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatTitle.trim() || !newCatSlug.trim()) {
      setCatError("Title and slug are required.");
      return;
    }

    setCatLoading(true);
    setCatError(null);

    const res = await createCategoryAction(packageId, {
      title: newCatTitle.trim(),
      slug: newCatSlug.trim(),
      displayOrder: Number(newCatOrder),
    });

    if (res && res.error) {
      setCatError(res.error);
      setCatLoading(false);
    } else {
      setNewCatTitle("");
      setNewCatSlug("");
      setNewCatOrder(0);
      setCatLoading(false);
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const startEditCategory = (cat: CategoryItem) => {
    setEditingCatId(cat.id);
    setEditCatTitle(cat.title);
    setEditCatSlug(cat.slug);
    setEditCatOrder(cat.displayOrder);
    setCatError(null);
  };

  const handleUpdateCategory = async (catId: string) => {
    if (!editCatTitle.trim() || !editCatSlug.trim()) {
      setCatError("Title and slug are required.");
      return;
    }

    setCatLoading(true);
    setCatError(null);

    const res = await updateCategoryAction(packageId, catId, {
      title: editCatTitle.trim(),
      slug: editCatSlug.trim(),
      displayOrder: Number(editCatOrder),
    });

    if (res && res.error) {
      setCatError(res.error);
      setCatLoading(false);
    } else {
      setEditingCatId(null);
      setCatLoading(false);
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleDeleteCategory = async (catId: string, title: string) => {
    if (!await confirm(`Are you sure you want to delete category "${title}"? Associated documents will be uncategorized.`, { title: "delete category" })) return;

    const res = await deleteCategoryAction(packageId, catId);
    if (res && res.error) {
      alert(res.error);
    } else {
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleDeleteDoc = async (docId: string, title: string) => {
    if (!await confirm(`Are you sure you want to delete documentation page "${title}"?`, { title: "delete documentation page" })) return;

    const res = await deleteDocAction(packageId, docId, groupSlug);
    if (res && res.error) {
      alert(res.error);
    } else {
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const getCategoryName = (catId?: string | null) => {
    if (!catId) return <em style={{ color: "var(--muted)" }}>None (Uncategorized)</em>;
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.title : <em style={{ color: "var(--muted)" }}>None (Uncategorized)</em>;
  };

  return (
    <div style={{ marginTop: "3rem", borderTop: "1px solid var(--border)", paddingTop: "2rem" }}>
      <div className={styles.sectionHeader} style={{ marginBottom: "1.5rem" }}>
        <h2 className={styles.sectionTitle} style={{ fontSize: "1.2rem", fontWeight: 600 }}>Documentation Center</h2>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            className={`${styles.simplePaginationButton} ${subTab === "docs" ? styles.editLink : ""}`}
            onClick={() => setSubTab("docs")}
            style={{ fontWeight: subTab === "docs" ? "bold" : "normal" }}
          >
            Documentation Pages ({docs.length})
          </button>
          <span style={{ color: "var(--border)" }}>|</span>
          <button
            type="button"
            className={`${styles.simplePaginationButton} ${subTab === "categories" ? styles.editLink : ""}`}
            onClick={() => setSubTab("categories")}
            style={{ fontWeight: subTab === "categories" ? "bold" : "normal" }}
          >
            Categories ({categories.length})
          </button>
        </div>
      </div>

      <div style={{ opacity: isPending ? 0.7 : 1, transition: "opacity 0.2s" }}>
        {/* SUBTAB: DOCUMENTS */}
        {subTab === "docs" && (
          <div>
            <div className={styles.sectionHeader} style={{ marginBottom: "1rem" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>Manage markdown manuals and articles</span>
              <Link href={`/dashboard/package-groups/${packageId}/docs/new?groupSlug=${groupSlug}`} className="btnAccent" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
                + Add Doc Page
              </Link>
            </div>

            {docs.length === 0 ? (
              <p className={styles.empty}>No documentation pages created for this package yet.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Title</th>
                      <th className={styles.th}>Category</th>
                      <th className={styles.th}>File Path</th>
                      <th className={styles.th}>Status</th>
                      <th className={styles.thRight}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc) => (
                      <tr key={doc.id} className={styles.tr}>
                        <td className={styles.td}>
                          <span style={{ fontWeight: 600 }}>{doc.title}</span>
                          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>slug: /{doc.slug}</div>
                        </td>
                        <td className={styles.td}>
                          {getCategoryName(doc.categoryId)}
                        </td>
                        <td className={styles.td}>
                          <code style={{ fontSize: "0.85rem" }}>{doc.filePath}</code>
                        </td>
                        <td className={styles.td}>
                          <span className={doc.isPublished ? styles.statusPublished : styles.statusDraft}>
                            {doc.isPublished ? "published" : "draft"}
                          </span>
                        </td>
                        <td className={styles.tdRight}>
                          <div className={styles.rowActions}>
                            <Link href={`/dashboard/package-groups/${packageId}/docs/edit/${doc.id}`} className={styles.editLink}>
                              Edit
                            </Link>
                              <button
                                type="button"
                                className={styles.editLink}
                                style={{ color: "var(--error)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                                onClick={() => handleDeleteDoc(doc.id, doc.title)}
                              >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB: CATEGORIES */}
        {subTab === "categories" && (
          <div>
            <span style={{ fontSize: "0.9rem", color: "var(--muted)", display: "block", marginBottom: "1rem" }}>
              Group and order your documentation side menu chapters
            </span>

            {catError && (
              <div className="errorMsg" style={{ marginBottom: "1rem" }}>
                {catError}
              </div>
            )}

            {/* Quick Add Inline Form */}
            <form onSubmit={handleAddCategory} style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap", background: "color-mix(in srgb, var(--border) 10%, transparent)", padding: "12px", marginBottom: "1.5rem" }}>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <label className="label" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Getting Started"
                  value={newCatTitle}
                  onChange={(e) => handleNewTitleChange(e.target.value)}
                  className="input"
                  style={{ margin: 0, padding: "6px" }}
                />
              </div>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <label className="label" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>Slug</label>
                <input
                  type="text"
                  required
                  placeholder="getting-started"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(slugify(e.target.value))}
                  className="input"
                  style={{ margin: 0, padding: "6px" }}
                />
              </div>
              <div style={{ width: "90px" }}>
                <label className="label" style={{ fontSize: "0.8rem", marginBottom: "4px" }}>Order</label>
                <input
                  type="number"
                  required
                  value={newCatOrder}
                  onChange={(e) => setNewCatOrder(Number(e.target.value))}
                  className="input"
                  style={{ margin: 0, padding: "6px" }}
                />
              </div>
              <button
                type="submit"
                disabled={catLoading}
                className="btnAccent"
                style={{ fontSize: "0.85rem", padding: "8px 16px", height: "35px" }}
              >
                {catLoading ? "Adding..." : "+ Add Category"}
              </button>
            </form>

            {categories.length === 0 ? (
              <p className={styles.empty}>No categories created for this package yet.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th} style={{ width: "80px" }}>Order</th>
                      <th className={styles.th}>Title</th>
                      <th className={styles.th}>Slug</th>
                      <th className={styles.thRight}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => (
                      <tr key={cat.id} className={styles.tr}>
                        {editingCatId === cat.id ? (
                          /* Editing State Inline Form Rows */
                          <>
                            <td className={styles.td}>
                              <input
                                type="number"
                                required
                                value={editCatOrder}
                                onChange={(e) => setEditCatOrder(Number(e.target.value))}
                                className="input"
                                style={{ margin: 0, padding: "4px", fontSize: "0.85rem" }}
                              />
                            </td>
                            <td className={styles.td}>
                              <input
                                type="text"
                                required
                                value={editCatTitle}
                                onChange={(e) => handleEditTitleChange(e.target.value)}
                                className="input"
                                style={{ margin: 0, padding: "4px", fontSize: "0.85rem" }}
                              />
                            </td>
                            <td className={styles.td}>
                              <input
                                type="text"
                                required
                                value={editCatSlug}
                                onChange={(e) => setEditCatSlug(slugify(e.target.value))}
                                className="input"
                                style={{ margin: 0, padding: "4px", fontSize: "0.85rem" }}
                              />
                            </td>
                            <td className={styles.tdRight}>
                              <div className={styles.rowActions}>
                                <button
                                  type="button"
                                  className={styles.editLink}
                                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                                  onClick={() => handleUpdateCategory(cat.id)}
                                  disabled={catLoading}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className={styles.editLink}
                                  style={{ color: "var(--muted)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                                  onClick={() => setEditingCatId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          /* Standard View Rows */
                          <>
                            <td className={styles.td} style={{ fontWeight: 600 }}>
                              {cat.displayOrder}
                            </td>
                            <td className={styles.td} style={{ fontWeight: 600 }}>
                              {cat.title}
                            </td>
                            <td className={styles.td}>
                              <code>{cat.slug}</code>
                            </td>
                            <td className={styles.tdRight}>
                              <div className={styles.rowActions}>
                                <button
                                  type="button"
                                  className={styles.editLink}
                                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                                  onClick={() => startEditCategory(cat)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className={styles.editLink}
                                  style={{ color: "var(--error)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                                  onClick={() => handleDeleteCategory(cat.id, cat.title)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
