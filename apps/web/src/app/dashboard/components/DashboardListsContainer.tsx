"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useConfirm } from "./ConfirmProvider";
import { formatDate } from "../../../lib/formatDate";
import { CONTENT_LABELS, CONTENT_TYPES, contentHref, type ContentItem, type ContentQuery } from "./content-list";
import styles from "./DashboardListsContainer.module.css";

type DeleteAction = (id: string) => Promise<{ success?: boolean; error?: string }>;

interface DashboardListsContainerProps {
  state: ContentQuery;
  items: ContentItem[];
  total: number;
  totalPages: number;
  error: boolean;
  deletePostAction: DeleteAction;
  deleteProjectAction: DeleteAction;
  deletePageAction: DeleteAction;
}

function DeleteContentButton({ item, type, onDelete }: { item: ContentItem; type: string; onDelete: DeleteAction }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!await confirm(`Are you sure you want to delete the ${type} "${item.title}"?`, { title: `Delete ${type}` })) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await onDelete(item.id);
        if (result.error) setError(result.error);
        else router.refresh();
      } catch {
        setError(`Could not delete ${type}. Please try again.`);
      }
    });
  }

  return (
    <div className={styles.deleteAction}>
      <button type="button" className={`btnGhost ${styles.rowButton}`} onClick={handleDelete} disabled={pending} aria-label={`Delete ${item.title}`}>
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <span className={styles.actionError} role="alert">{error}</span>}
    </div>
  );
}

export default function DashboardListsContainer({
  state, items, total, totalPages, error,
  deletePostAction, deleteProjectAction, deletePageAction,
}: DashboardListsContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const meta = CONTENT_LABELS[state.type];
  const deleteAction = { posts: deletePostAction, projects: deleteProjectAction, pages: deletePageAction }[state.type];
  const currentParams = searchParams.toString();
  const update = (updates: Parameters<typeof contentHref>[2]) => {
    startTransition(() => router.push(contentHref(currentParams, state.type, updates), { scroll: false }));
  };
  const filtered = Boolean(state.query || state.status);
  const first = total === 0 ? 0 : (state.page - 1) * state.limit + 1;
  const last = Math.min(state.page * state.limit, total);

  return (
    <section className={styles.content} aria-label="Content management" aria-busy={pending}>
      <nav className={styles.tabs} aria-label="Content types">
        {CONTENT_TYPES.map((type) => (
          <Link
            key={type}
            href={contentHref(currentParams, type)}
            className={`${styles.tab} ${state.type === type ? styles.activeTab : ""}`}
            aria-current={state.type === type ? "page" : undefined}
            scroll={false}
            prefetch={false}
          >
            {CONTENT_LABELS[type].label}
          </Link>
        ))}
      </nav>

      <div className={styles.heading}>
        <h2 className={styles.title}>{meta.label}</h2>
        <Link href={`/dashboard/${state.type}/new`} className="btnAccent">+ New {meta.singular}</Link>
      </div>

      <form
        key={`${state.type}:${state.query}:${state.status}`}
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const status = form.get("status");
          update({ query: String(form.get("query") ?? "").trim(), status: status === "draft" || status === "published" ? status : "" });
        }}
      >
        <div className={styles.searchField}>
          <label htmlFor="content-search">Search {meta.label.toLowerCase()}</label>
          <input id="content-search" name="query" type="search" defaultValue={state.query} placeholder="Search title or slug" className={styles.input} disabled={pending} />
        </div>
        <div className={styles.statusField}>
          <label htmlFor="content-status">Status</label>
          <select id="content-status" name="status" defaultValue={state.status} className={styles.input} disabled={pending} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <button type="submit" className="btnGhost" disabled={pending}>Search</button>
        {filtered && <button type="button" className="btnGhost" disabled={pending} onClick={() => update({ query: "", status: "" })}>Clear</button>}
      </form>

      {error ? (
        <div className={styles.error} role="alert">
          <p>Could not load {meta.label.toLowerCase()}. Please try again.</p>
          <button type="button" className="btnGhost" onClick={() => startTransition(() => router.refresh())} disabled={pending}>Retry</button>
        </div>
      ) : (
        <>
          <p className={styles.summary} role="status">{pending ? "Loading…" : `${total} ${filtered ? "matching " : ""}${total === 1 ? meta.singular : meta.label.toLowerCase()}`}</p>
          <div className={styles.tableWrapper} role="region" aria-label={`${meta.label} table`} tabIndex={0}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>{meta.label} content management</caption>
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Path</th>
                  <th scope="col">Status</th>
                  {state.type === "posts" && <th scope="col">Author</th>}
                  {state.type === "projects" && <><th scope="col">Featured</th><th scope="col">Order</th></>}
                  <th scope="col">Updated</th>
                  <th scope="col" className={styles.actionsHeading}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <th scope="row" className={styles.itemTitle}>
                      <Link href={`/dashboard/${state.type}/edit/${item.id}`}>{item.title}</Link>
                    </th>
                    <td className={styles.path}>{meta.path}{item.slug}</td>
                    <td><span className={item.status === "published" ? styles.published : styles.draft}>{item.status === "published" ? "Published" : "Draft"}</span></td>
                    {state.type === "posts" && <td>{item.author?.displayName ?? item.author?.username ?? "—"}</td>}
                    {state.type === "projects" && <><td>{item.featured ? "Yes" : "No"}</td><td>{item.sortOrder ?? 0}</td></>}
                    <td className={styles.date}><time dateTime={item.updatedAt}>{formatDate(item.updatedAt, "en")}</time></td>
                    <td>
                      <div className={styles.rowActions}>
                        {item.status === "published" && <Link href={`${meta.path}${item.slug}`} target="_blank" rel="noopener noreferrer" className={`btnGhost ${styles.rowButton}`} aria-label={`View ${item.title} (opens in a new tab)`}>View</Link>}
                        <Link href={`/dashboard/${state.type}/edit/${item.id}`} className={`btnGhost ${styles.rowButton}`} aria-label={`Edit ${item.title}`}>Edit</Link>
                        <DeleteContentButton item={item} type={meta.singular} onDelete={deleteAction} />
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={state.type === "projects" ? 7 : state.type === "posts" ? 6 : 5} className={styles.empty}>
                    {filtered ? `No ${meta.label.toLowerCase()} match your search or filters.` : `No ${meta.label.toLowerCase()} added yet.`}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.pagination}>
            <div className={styles.pageControls} aria-label="Content pagination">
              <button type="button" className="btnGhost" disabled={pending || state.page <= 1} onClick={() => update({ page: state.page - 1 })}>← Previous</button>
              <span>Page {state.page} of {Math.max(1, totalPages)}</span>
              <button type="button" className="btnGhost" disabled={pending || state.page >= totalPages} onClick={() => update({ page: state.page + 1 })}>Next →</button>
            </div>
            <div className={styles.pageSize}>
              <span>{first}–{last} of {total}</span>
              <label htmlFor="content-page-size">Rows per page</label>
              <select id="content-page-size" value={state.limit} disabled={pending} className={styles.input} onChange={(event) => update({ limit: Number(event.target.value) })}>
                <option value="10">10</option><option value="50">50</option><option value="100">100</option>
              </select>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
