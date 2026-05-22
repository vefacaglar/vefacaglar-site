"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import clientStyles from "./games-client.module.css";
import {
  createDeveloperAction,
  updateDeveloperAction,
  deleteDeveloperAction,
  createPublisherAction,
  updatePublisherAction,
  deletePublisherAction,
  createGenreAction,
  updateGenreAction,
  deleteGenreAction,
} from "./actions";

// Types matching the backend response
export interface Developer {
  id: string;
  name: string;
  slug: string;
  countryCode: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface Publisher {
  id: string;
  name: string;
  slug: string;
  countryCode: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string | null;
}

interface GamesDashboardClientProps {
  initialDevelopers: {
    items: Developer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialPublishers: {
    items: Publisher[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  initialGenres: {
    items: Genre[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function GamesDashboardClient({
  initialDevelopers,
  initialPublishers,
  initialGenres,
}: GamesDashboardClientProps) {
  const router = useRouter();

  // Developers state
  const [developers, setDevelopers] = useState<Developer[]>(initialDevelopers.items);
  const [totalDevs, setTotalDevs] = useState(initialDevelopers.total);

  // Publishers state
  const [publishers, setPublishers] = useState<Publisher[]>(initialPublishers.items);
  const [totalPublishers, setTotalPublishers] = useState(initialPublishers.total);

  // Genres state
  const [genres, setGenres] = useState<Genre[]>(initialGenres.items);
  const [totalGenres, setTotalGenres] = useState(initialGenres.total);

  // Sync state when props change (Next.js server-side revalidation)
  useEffect(() => {
    setDevelopers(initialDevelopers.items);
    setTotalDevs(initialDevelopers.total);
  }, [initialDevelopers]);

  useEffect(() => {
    setPublishers(initialPublishers.items);
    setTotalPublishers(initialPublishers.total);
  }, [initialPublishers]);

  useEffect(() => {
    setGenres(initialGenres.items);
    setTotalGenres(initialGenres.total);
  }, [initialGenres]);

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeType, setActiveType] = useState<"developer" | "publisher" | "genre">("developer");
  const [editingItem, setEditingItem] = useState<Developer | Publisher | Genre | null>(null);
  
  // Form states
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper to slugify title/name
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
      .replace(/[\s_]+/g, "-") // Replace spaces and underscores with -
      .replace(/[^\w\-]+/g, "") // Remove all non-word chars except -
      .replace(/\-\-+/g, "-") // Replace multiple - with single -
      .replace(/^-+/, "") // Trim - from start
      .replace(/-+$/, ""); // Trim - from end
  };

  // Auto-generate slug from name only when creating a new record
  useEffect(() => {
    if (!editingItem) {
      setSlug(slugify(name));
    }
  }, [name, editingItem]);

  const openAddModal = (type: "developer" | "publisher" | "genre") => {
    setActiveType(type);
    setEditingItem(null);
    setName("");
    setSlug("");
    setCountryCode("");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (type: "developer" | "publisher" | "genre", item: Developer | Publisher | Genre) => {
    setActiveType(type);
    setEditingItem(item);
    setName(item.name);
    setSlug(item.slug);
    setCountryCode((item as any).countryCode || "");
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setName("");
    setSlug("");
    setCountryCode("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!slug.trim()) {
      setError("Slug is required");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
    };

    let res;
    if (activeType === "developer") {
      if (editingItem) {
        res = await updateDeveloperAction(editingItem.id, {
          ...payload,
          countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : null
        });
      } else {
        res = await createDeveloperAction({
          ...payload,
          countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : undefined
        });
      }
    } else if (activeType === "publisher") {
      if (editingItem) {
        res = await updatePublisherAction(editingItem.id, {
          ...payload,
          countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : null
        });
      } else {
        res = await createPublisherAction({
          ...payload,
          countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : undefined
        });
      }
    } else if (activeType === "genre") {
      if (editingItem) {
        res = await updateGenreAction(editingItem.id, payload);
      } else {
        res = await createGenreAction(payload);
      }
    }

    if (res && res.error) {
      setError(res.error);
      setLoading(false);
    } else {
      closeModal();
      setLoading(false);
      router.refresh();
    }
  };

  const handleDelete = async (type: "developer" | "publisher" | "genre", id: string, itemName: string) => {
    if (!confirm(`Are you sure you want to delete ${type} "${itemName}"?`)) {
      return;
    }

    let res;
    if (type === "developer") {
      res = await deleteDeveloperAction(id);
    } else if (type === "publisher") {
      res = await deletePublisherAction(id);
    } else if (type === "genre") {
      res = await deleteGenreAction(id);
    }

    if (res && res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  return (
    <div>
      {/* Developers Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Developers ({totalDevs})</h2>
          <button className="btnAccent" onClick={() => openAddModal("developer")}>
            + New Developer
          </button>
        </div>

        {developers.length === 0 ? (
          <div className={clientStyles.emptyState}>
            No developers found. Click "+ New Developer" to create your first developer record.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Slug</th>
                <th className={styles.th}>Country</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {developers.map((dev) => (
                <tr key={dev.id} className={styles.tr}>
                  <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                    {dev.name}
                  </td>
                  <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                    {dev.slug}
                  </td>
                  <td className={styles.td}>
                    {dev.countryCode || "—"}
                  </td>
                  <td className={styles.tdRight}>
                    <div className={styles.rowActions}>
                      <button 
                        className={styles.editLink} 
                        onClick={() => openEditModal("developer", dev)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                      >
                        Edit
                      </button>
                      <button 
                        className={styles.editLink} 
                        onClick={() => handleDelete("developer", dev.id, dev.name)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Publishers Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Publishers ({totalPublishers})</h2>
          <button className="btnAccent" onClick={() => openAddModal("publisher")}>
            + New Publisher
          </button>
        </div>

        {publishers.length === 0 ? (
          <div className={clientStyles.emptyState}>
            No publishers found. Click "+ New Publisher" to create your first publisher record.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Slug</th>
                <th className={styles.th}>Country</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {publishers.map((pub) => (
                <tr key={pub.id} className={styles.tr}>
                  <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                    {pub.name}
                  </td>
                  <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                    {pub.slug}
                  </td>
                  <td className={styles.td}>
                    {pub.countryCode || "—"}
                  </td>
                  <td className={styles.tdRight}>
                    <div className={styles.rowActions}>
                      <button 
                        className={styles.editLink} 
                        onClick={() => openEditModal("publisher", pub)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                      >
                        Edit
                      </button>
                      <button 
                        className={styles.editLink} 
                        onClick={() => handleDelete("publisher", pub.id, pub.name)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Genres Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Genres ({totalGenres})</h2>
          <button className="btnAccent" onClick={() => openAddModal("genre")}>
            + New Genre
          </button>
        </div>

        {genres.length === 0 ? (
          <div className={clientStyles.emptyState}>
            No genres found. Click "+ New Genre" to create your first genre record.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Slug</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {genres.map((genre) => (
                <tr key={genre.id} className={styles.tr}>
                  <td className={styles.td} style={{ fontWeight: 500, color: "var(--text-heading)" }}>
                    {genre.name}
                  </td>
                  <td className={styles.td} style={{ fontSize: "13px", color: "var(--text)" }}>
                    {genre.slug}
                  </td>
                  <td className={styles.tdRight}>
                    <div className={styles.rowActions}>
                      <button 
                        className={styles.editLink} 
                        onClick={() => openEditModal("genre", genre)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                      >
                        Edit
                      </button>
                      <button 
                        className={styles.editLink} 
                        onClick={() => handleDelete("genre", genre.id, genre.name)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, color: "var(--accent)" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Modern Overlay Form Modal for Add/Edit */}
      {isModalOpen && (
        <div className={clientStyles.modalOverlay} onClick={closeModal}>
          <div className={clientStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={clientStyles.modalHeader}>
              <h3 className={clientStyles.modalTitle}>
                {editingItem 
                  ? `Edit ${activeType === "developer" ? "Developer" : activeType === "publisher" ? "Publisher" : "Genre"}` 
                  : `New ${activeType === "developer" ? "Developer" : activeType === "publisher" ? "Publisher" : "Genre"}`
                }
              </h3>
              <button className={clientStyles.modalClose} onClick={closeModal}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {error && <div className={clientStyles.errorMsg}>{error}</div>}

              <div className={clientStyles.formGroup}>
                <label className={clientStyles.label} htmlFor="item-name">Name</label>
                <input
                  id="item-name"
                  type="text"
                  className={clientStyles.input}
                  placeholder={
                    activeType === "developer" 
                      ? "Nintendo EPD, FromSoftware..." 
                      : activeType === "publisher" 
                        ? "Nintendo, Bandai Namco..." 
                        : "Action, RPG, Platformer..."
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                />
              </div>

              <div className={clientStyles.formGroup}>
                <label className={clientStyles.label} htmlFor="item-slug">Slug</label>
                <input
                  id="item-slug"
                  type="text"
                  className={clientStyles.input}
                  placeholder={
                    activeType === "developer" 
                      ? "nintendo-epd" 
                      : activeType === "publisher" 
                        ? "nintendo" 
                        : "action"
                  }
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              {activeType !== "genre" && (
                <div className={clientStyles.formGroup}>
                  <label className={clientStyles.label} htmlFor="item-country">Country Code (2 letters, optional)</label>
                  <input
                    id="item-country"
                    type="text"
                    maxLength={2}
                    className={clientStyles.input}
                    placeholder="JP, US, TR, PL..."
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    disabled={loading}
                  />
                </div>
              )}

              <div className={clientStyles.modalActions}>
                <button type="button" className={clientStyles.btnCancel} onClick={closeModal} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btnAccent" disabled={loading}>
                  {loading 
                    ? "Saving..." 
                    : (editingItem 
                        ? "Save Changes" 
                        : `Create ${activeType === "developer" ? "Developer" : activeType === "publisher" ? "Publisher" : "Genre"}`
                      )
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
