import Link from 'next/link';

export default function Projects() {
  return (
    <div>
      <div style={{ marginBottom: "48px" }}>
        <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>← back</Link>
      </div>
      <h1>Projects</h1>
      <p>Wastecross (In Development)</p>
    </div>
  );
}
