import styles from "./Skeleton.module.css";

export function GamesGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={styles.list} aria-hidden="true">
      {Array.from({ length: count }, (_, idx) => (
        <div key={idx} className={styles.row}>
          <div className={`${styles.block} ${styles.rowTitle}`} />
          <div className={styles.rowMeta}>
            <div className={`${styles.block} ${styles.rowDetail}`} />
            <div className={`${styles.block} ${styles.rowYear}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileShelfSkeleton({ count = 8 }: { count?: number }) {
  return (
    <section aria-busy="true">
      <div className={styles.shelfBar} aria-hidden="true">
        <div className={styles.tabGroup}>
          <div className={`${styles.block} ${styles.tabPill}`} />
          <div className={`${styles.block} ${styles.tabPill}`} />
          <div className={`${styles.block} ${styles.tabPill}`} />
        </div>
        <div className={styles.toolGroup}>
          <div className={`${styles.block} ${styles.toolPill}`} />
          <div className={`${styles.block} ${styles.toolPill}`} />
        </div>
      </div>
      <GamesGridSkeleton count={count} />
    </section>
  );
}
