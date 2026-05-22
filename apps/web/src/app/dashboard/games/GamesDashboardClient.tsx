"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "../dashboard.module.css";
import clientStyles from "./games-client.module.css";
import { createDeveloperAction, updateDeveloperAction, deleteDeveloperAction } from "./actions";

// Types matching the backend response
export interface Developer {
  id: string;
  name: string;
  slug: string;
  countryCode: string | null;
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
}

export default function GamesDashboardClient({ initialDevelopers }: GamesDashboardClientProps) {
  const router = useRouter();
  const [developers, setDevelopers] = useState<Developer[]>(initialDevelopers.items);
  const [total, setTotal] = useState(initialDevelopers.total);

  // Sync state when props change (Next.js server-side revalidation)
  useEffect(() => {
    setDevelopers(initialDevelopers.items);
    setTotal(initialDevelopers.total);
  }, [initialDevelopers]);

  // Modal control states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDev, setEditingDev] = useState<Developer | null>(null);
  
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
    if (!editingDev) {
      setSlug(slugify(name));
    }
  }, [name, editingDev]);

  const openAddModal = () => {
    setEditingDev(null);
    setName("");
    setSlug("");
    setCountryCode("");
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dev: Developer) => {
    setEditingDev(dev);
    setName(dev.name);
    setSlug(dev.slug);
    setCountryCode(dev.countryCode || "");
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDev(null);
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
      countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : undefined,
    };

    let res;
    if (editingDev) {
      res = await updateDeveloperAction(editingDev.id, {
        ...payload,
        countryCode: countryCode.trim() ? countryCode.trim().toUpperCase() : null
      });
    } else {
      res = await createDeveloperAction(payload);
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

  const handleDelete = async (id: string, devName: string) => {
    if (!confirm(`Are you sure you want to delete developer "${devName}"?`)) {
      return;
    }

    const res = await deleteDeveloperAction(id);
    if (res && res.error) {
      alert(res.error);
    } else {
      router.refresh();
    }
  };

  return (
    <div>
      {/* 2. Developers Catalog */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Developers ({total})</h2>
          <button className="btnAccent" onClick={openAddModal}>
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
                        onClick={() => openEditModal(dev)}
                        style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                      >
                        Edit
                      </button>
                      <button 
                        className={styles.editLink} 
                        onClick={() => handleDelete(dev.id, dev.name)}
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
                {editingDev ? "Edit Developer" : "New Developer"}
              </h3>
              <button className={clientStyles.modalClose} onClick={closeModal}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {error && <div className={clientStyles.errorMsg}>{error}</div>}

              <div className={clientStyles.formGroup}>
                <label className={clientStyles.label} htmlFor="dev-name">Name</label>
                <input
                  id="dev-name"
                  type="text"
                  className={clientStyles.input}
                  placeholder="Nintendo EPD, FromSoftware..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                />
              </div>

              <div className={clientStyles.formGroup}>
                <label className={clientStyles.label} htmlFor="dev-slug">Slug</label>
                <input
                  id="dev-slug"
                  type="text"
                  className={clientStyles.input}
                  placeholder="nintendo-epd"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className={clientStyles.formGroup}>
                <label className={clientStyles.label} htmlFor="dev-country">Country Code (2 letters, optional)</label>
                <input
                  id="dev-country"
                  type="text"
                  maxLength={2}
                  className={clientStyles.input}
                  placeholder="JP, US, TR, PL..."
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className={clientStyles.modalActions}>
                <button type="button" className={clientStyles.btnCancel} onClick={closeModal} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btnAccent" disabled={loading}>
                  {loading ? "Saving..." : (editingDev ? "Save Changes" : "Create Developer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
