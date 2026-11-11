import styles from "../../../components/library/Skeleton.module.css";
import { GamesGridSkeleton } from "../../../components/library/LibrarySkeletons";

export default function ProfileOverviewLoading() {
  return (
    <div aria-busy="true" aria-hidden="true">
      <div className={styles.stats}>
        {Array.from({ length: 4 }, (_, idx) => (
          <div key={idx} className={styles.stat}>
            <div className={`${styles.block} ${styles.statValue}`} />
            <div className={`${styles.block} ${styles.statLabel}`} />
          </div>
        ))}
      </div>

      <div className={styles.sectionBlock}>
        <div className={styles.sectionHead}>
          <div className={`${styles.block} ${styles.sectionTitle}`} />
        </div>
        <div className={styles.activityList}>
          {Array.from({ length: 6 }, (_, idx) => (
            <div key={idx} className={styles.activityRow}>
              <div className={styles.activityLeft}>
                <div className={`${styles.block} ${styles.activityDot}`} />
                <div className={`${styles.block} ${styles.activityTitle}`} />
              </div>
              <div className={styles.activityRight}>
                <div className={`${styles.block} ${styles.activityHours}`} />
                <div className={`${styles.block} ${styles.activityStatus}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.sectionBlock}>
        <div className={styles.sectionHead}>
          <div className={`${styles.block} ${styles.sectionTitle}`} />
        </div>
        <GamesGridSkeleton count={6} />
      </div>
    </div>
  );
}
