import Link from 'next/link';

export default function Blog() {
  return (
    <div>
      <div style={{ marginBottom: "48px" }}>
        <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>← back</Link>
      </div>
      <h1>Blog</h1>
      <p>Writing about technical decisions and game development.</p>
      <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
        <li style={{ marginBottom: "16px", paddingLeft: "20px", position: "relative" }}>
          <span style={{ position: "absolute", left: 0, color: "var(--muted)" }}>—</span>
          <Link href="/blog/backend-architecture-lessons">Backend Architecture Lessons Learned</Link>
        </li>
      </ul>
    </div>
  );
}
