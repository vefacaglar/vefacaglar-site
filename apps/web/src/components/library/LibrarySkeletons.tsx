import styles from "./Skeleton.module.css";

export function GamesGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: count }, (_, idx) => (
        <div key={idx} className={styles.card}>
          <div className={`${styles.block} ${styles.cover}`} />
          <div className={`${styles.block} ${styles.cardTitle}`} />
          <div className={`${styles.block} ${styles.cardMeta}`} />
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
