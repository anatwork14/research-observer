import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getProgressEntries } from "@/lib/progress";

export default async function ProgressIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const entries = await getProgressEntries();
  const filters = await searchParams;
  const visible = entries.filter((entry) => {
    if (filters.type && entry.type !== filters.type) return false;
    if (filters.status && entry.status !== filters.status) return false;
    return true;
  });
  const navEntries = entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="notes" />
      <main className="collection-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Notes</p>
            <h1>Research log</h1>
            <p>Ordered Markdown notes remain the durable record of the work.</p>
          </div>
          <span className="collection-count">{visible.length} / {entries.length}</span>
        </header>

        <section className="note-index panel">
          {visible.map((entry) => (
            <Link key={entry.slug} href={`/progress/${entry.slug}`} className="note-index-row">
              <span className="note-index-order">{String(entry.order).padStart(2, "0")}</span>
              <span className="note-index-copy">
                <strong>{entry.title}</strong>
                <small>{entry.summary || entry.filename}</small>
              </span>
              <span className="note-index-meta">
                {entry.type && <em>{entry.type}</em>}
                {entry.status && <em>{entry.status}</em>}
                <small>{entry.readingMinutes} min</small>
              </span>
            </Link>
          ))}
          {!visible.length && <p className="quiet">No notes match the selected view.</p>}
        </section>
      </main>
    </div>
  );
}
