import Link from 'next/link';

export default function About() {
  return (
    <div>
      <div style={{ marginBottom: "48px" }}>
        <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>← back</Link>
      </div>
      <h1>About Me</h1>
      <p>I'm a software engineer with a focus on backend architecture, microservices, and indie game dev.</p>
    </div>
  );
}