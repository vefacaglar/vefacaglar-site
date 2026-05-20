import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <h1 style={{ marginBottom: "32px" }}>Vefa Çağlar</h1>
      
      <p style={{ marginBottom: "32px" }}>
        I'm a software engineer and indie game developer. I write about backend systems, game development, tools, and technical decisions from the projects I work on.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "48px" }}>
        <Link href="/about">About</Link>
        <a href="https://linkedin.com">LinkedIn</a>
        <a href="https://x.com">X (Twitter)</a>
        <a href="https://github.com">GitHub</a>
      </div>

      <h2 style={{ margin: "48px 0 16px 0" }}>Current Project</h2>
      <p style={{ marginBottom: "48px" }}>
        <strong>Wastecross:</strong> a post-apocalyptic top-down action RPG about reopening roads between fractured zones in Unity.
      </p>

      <h2 style={{ margin: "48px 0 16px 0" }}>Writings</h2>
      <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
        <li style={{ marginBottom: "16px", paddingLeft: "20px", position: "relative" }}>
          <span style={{ position: "absolute", left: 0, color: "var(--muted)" }}>—</span>
          <Link href="/blog/backend-architecture-lessons">Backend Architecture Lessons Learned</Link>
        </li>
        <li style={{ marginBottom: "16px", paddingLeft: "20px", position: "relative" }}>
          <span style={{ position: "absolute", left: 0, color: "var(--muted)" }}>—</span>
          <Link href="/blog/indie-game-dev-log">Indie Game Dev Log: Movement Systems</Link>
        </li>
      </ul>
      
      <div style={{ marginTop: "48px" }}>
        <Link href="/projects">View all projects</Link>
      </div>
    </div>
  );
}
