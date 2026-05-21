import BackButton from '../components/BackButton';
import styles from './projects.module.css';

export default function Projects() {
  return (
    <div>
      <div className={styles.back}>
        <BackButton />
      </div>
      <h1>Projects</h1>
      <p>Wastecross (In Development)</p>
    </div>
  );
}
