import styles from "../../../../../../components/library/Skeleton.module.css";

export default function GameLogLoading() {
  return (
    <div aria-busy="true" aria-hidden="true">
      <div className={styles.logHeader}>
        <div className={`${styles.block} ${styles.heroBack}`} />
        <div className={`${styles.block} ${styles.titleBar}`} />
      </div>

      <div className={styles.logLayout}>
        <div className={styles.logSidebar}>
          <div className={`${styles.logSidebarCard} ${styles.logGameSummaryCard}`}>
            <div className={`${styles.block} ${styles.cardTitle}`} />
            <div className={`${styles.block} ${styles.cardMeta}`} />
          </div>
          <div className={styles.logSidebarCard}>
            <div className={`${styles.block} ${styles.cardMeta}`} />
            <div className={`${styles.block} ${styles.logSidebarBox}`} />
          </div>
          <div className={styles.logSidebarCard}>
            <div className={`${styles.block} ${styles.cardMeta}`} />
            <div className={`${styles.block} ${styles.logField}`} />
          </div>
        </div>

        <div className={styles.logForm}>
          <div className={styles.logFormGrid}>
            <div className={`${styles.block} ${styles.logField}`} />
            <div className={`${styles.block} ${styles.logField}`} />
            <div className={`${styles.block} ${styles.logField}`} />
            <div className={`${styles.block} ${styles.logField}`} />
            <div className={`${styles.block} ${styles.logField}`} />
            <div className={`${styles.block} ${styles.logField}`} />
          </div>
          <div className={`${styles.block} ${styles.logNotes}`} />
        </div>
      </div>
    </div>
  );
}
