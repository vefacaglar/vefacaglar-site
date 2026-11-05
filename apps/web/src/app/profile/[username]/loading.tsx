import styles from "../../../components/library/Skeleton.module.css";
import { GamesGridSkeleton } from "../../../components/library/LibrarySkeletons";

export default function ProfileOverviewLoading() {
  return (
    <div aria-busy="true" aria-hidden="true">
      <div className={styles.stats}>
        {Array.from({ length: 4 }, (_, idx) => (
          <div key={idx} className={styles.stat}>
            <div className={`${styles.block} ${styles.statLabel}`} />
            <div className={`${styles.block} ${styles.statValue}`} />
          </div>
        ))}
      </div>

      <div className={styles.sectionHead}>
        <div className={`${styles.block} ${styles.sectionTitle}`} />
      </div>
      <GamesGridSkeleton count={8} />
    </div>
  );
}
