import styles from "../../../components/library/Skeleton.module.css";

export default function GameDetailLoading() {
  return (
    <div aria-busy="true" aria-hidden="true">
      <div className={styles.hero}>
        <div className={`${styles.block} ${styles.cover}`} />
        <div className={styles.heroBody}>
          <div className={`${styles.block} ${styles.heroBack}`} />
          <div className={`${styles.block} ${styles.heroTitle}`} />
          <div className={`${styles.block} ${styles.heroByline}`} />
          <div className={styles.heroFigures}>
            <div className={`${styles.block} ${styles.heroFigure}`} />
            <div className={`${styles.block} ${styles.heroFigure}`} />
          </div>
        </div>
      </div>

      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <div className={`${styles.block} ${styles.paragraphLine}`} />
          <div className={`${styles.block} ${styles.paragraphLine}`} />
          <div className={`${styles.block} ${styles.paragraphLine}`} />
          <div className={`${styles.block} ${styles.paragraphLineShort}`} />
        </div>
        <div className={styles.detailAside}>
          <div className={`${styles.block} ${styles.asideLine}`} />
          <div className={`${styles.block} ${styles.asideLine}`} />
          <div className={`${styles.block} ${styles.asideLine}`} />
          <div className={`${styles.block} ${styles.asideLine}`} />
        </div>
      </div>
    </div>
  );
}
