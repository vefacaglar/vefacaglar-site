import React from "react";
import styles from "./ProfileCard.module.css";
import dashboardStyles from "../../dashboard.module.css";
import { Developer, Publisher } from "../types";
import ds from "../../../../lib/dashboard-strings";

type ProfileItem = Developer | Publisher;

interface ProfileCardProps {
  item: ProfileItem;
  type: "developer" | "publisher";
  onEdit: (type: "developer" | "publisher", item: ProfileItem) => void;
  onDelete: (type: "developer" | "publisher", item: ProfileItem) => void;
}

export default function ProfileCard({ item, type, onEdit, onDelete }: ProfileCardProps) {
  const initial = item.name.charAt(0).toUpperCase();

  return (
    <div className={styles.profileCard}>
      <div className={styles.profileCardHeader}>
        <div className={styles.profileCardIcon}>{initial}</div>
        <div className={styles.profileCardInfo}>
          <h4 className={styles.profileCardName} title={item.name}>{item.name}</h4>
          <div className={styles.profileCardSlug} title={item.slug}>{item.slug}</div>
        </div>
      </div>
      <div className={styles.profileCardFooter}>
        <span className={styles.profileCardCountry}>
          {item.countryCode ? `🏳️ ${item.countryCode}` : ds.games.card.global}
        </span>
        <div className={styles.profileCardActions}>
          <button
            type="button"
            className={`${dashboardStyles.editLink} ${styles.linkBtn}`}
            onClick={() => onEdit(type, item)}
          >
            {ds.games.buttons.edit}
          </button>
          <button
            type="button"
            className={`${dashboardStyles.editLink} ${styles.linkBtnDanger}`}
            onClick={() => onDelete(type, item)}
          >
            {ds.games.buttons.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
