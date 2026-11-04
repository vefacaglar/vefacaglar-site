"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import styles from "./ProfileGameList.module.css";

type ProfileGameListRowProps = {
  /** Id of the detail row, for aria-controls. */
  detailId: string;
  status: string;
  /** Number of columns the detail row spans. */
  columns: number;
  /** Visually hidden label of the toggle, e.g. "Details for Doom". */
  toggleLabel: string;
  /** The row's cells before the toggle column, rendered on the server. */
  cells: ReactNode;
  /** The panel shown under the row when it is open. */
  detail: ReactNode;
};

/**
 * One game in the list view: the row of figures and, under it, a detail panel the
 * reader opens with the toggle button. Clicking anywhere else on the row (but not
 * its links) opens it too, as a shortcut for the pointer.
 */
export default function ProfileGameListRow({
  detailId,
  status,
  columns,
  toggleLabel,
  cells,
  detail,
}: ProfileGameListRowProps) {
  const [open, setOpen] = useState(false);

  const onRowClick = (event: MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    // Selecting a title to copy it shouldn't fold the row.
    if (window.getSelection()?.toString()) return;
    setOpen((value) => !value);
  };

  return (
    <tbody className={styles.group} data-status={status} data-open={open ? "" : undefined}>
      <tr className={styles.row} onClick={onRowClick}>
        {cells}
        <td className={styles.toggleCell}>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((value) => !value)}
          >
            <span className={styles.toggleGlyph} aria-hidden="true" />
            <span className={styles.visuallyHidden}>{toggleLabel}</span>
          </button>
        </td>
      </tr>
      <tr id={detailId} className={styles.detailRow} hidden={!open}>
        <td colSpan={columns} className={styles.detailCell}>
          {detail}
        </td>
      </tr>
    </tbody>
  );
}
