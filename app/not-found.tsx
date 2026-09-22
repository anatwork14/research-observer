import Link from "next/link";

export default function NotFound() {
  return (
    <main className="empty-home">
      <div>
        <p className="eyebrow">Observaire / 404</p>
        <h1>Research note not found.</h1>
        <p className="hero-copy">The note may have been renamed, reordered, or removed. Stable IDs and aliases can preserve old links.</p>
        <Link className="page-arrows" href="/">Return to the research workspace</Link>
      </div>
    </main>
  );
}
