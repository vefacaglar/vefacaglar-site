import Link from 'next/link';

export default function BlogPost({ params }: { params: { slug: string } }) {
  return (
    <div>
      <div style={{ marginBottom: "48px" }}>
        <Link href="/blog" style={{ color: "var(--muted)", textDecoration: "none" }}>← back</Link>
      </div>
      <h1>{params.slug.replace(/-/g, ' ')}</h1>
      <p>Placeholder content for this blog post.</p>
    </div>
  );
}
