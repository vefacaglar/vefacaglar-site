import styles from "../../../components/library/Skeleton.module.css";
import { GamesGridSkeleton } from "../../../components/library/LibrarySkeletons";

export default function GamesLoading() {
  return (
    <div aria-busy="true">
      <div className={styles.masthead} aria-hidden="true">
        <div className={styles.mastheadText}>
          <div className={`${styles.block} ${styles.titleBar}`} />
          <div className={`${styles.block} ${styles.subtitleBar}`} />
        </div>
        <div className={`${styles.block} ${styles.searchBar}`} />
      </div>
      <GamesGridSkeleton count={10} />
    </div>
  );
}
