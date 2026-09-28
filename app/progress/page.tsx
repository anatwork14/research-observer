import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getProgressEntries, getResearchWorkspace } from "@/lib/progress";
import { matchesResearchText } from "@/lib/research/collection-filter.mjs";
import { CollectionFilters } from "@/components/CollectionFilters";
import { NewResearchNoteDialog } from "@/components/NewResearchNoteDialog";
import { noteCreateWritable } from "@/lib/research/note-create.mjs";

export default async function ProgressIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; research?: string; q?: string }>;
}) {
  const [entries, workspace] = await Promise.all([getProgressEntries(), getResearchWorkspace()]);
  const filters = await searchParams;
  const visible = entries.filter((entry) => {
    if (filters.type && entry.type !== filters.type) return false;
    if (filters.status && entry.status !== filters.status) return false;
    if (filters.research && entry.research !== filters.research) return false;
    if (!matchesResearchText([entry.title, entry.summary, entry.filename, entry.text, ...entry.tags], filters.q ?? "")) return false;
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
          <div className="collection-heading-actions">
            <span className="collection-count">{visible.length} / {entries.length}</span>
            <NewResearchNoteDialog
              types={workspace.config.allowedTypes}
              projects={workspace.projects.map(({ id, label }) => ({ id, label }))}
              research={filters.research ?? ""}
              enabled={noteCreateWritable()}
            />
          </div>
        </header>

        <CollectionFilters
          query={filters.q}
          type={filters.type}
          status={filters.status}
          typeOptions={workspace.config.allowedTypes.map((value) => ({ value, label: value }))}
          statusOptions={workspace.config.allowedStatuses.map((value) => ({ value, label: value }))}
          placeholder="Search titles, summaries, tags, and note text…"
        />

        <section className="note-index panel">
          {visible.map((entry) => (
            <Link key={entry.slug} href={`/progress/${entry.slug}`} className="note-index-row">
              <span className="note-index-order">{String(entry.order).padStart(2, "0")}</span>
              <span className="note-index-copy">
                <strong>{entry.title}</strong>
                <small>{entry.summary || entry.filename}</small>
              </span>
              <span className="note-index-meta">
                <em className="research-project-chip">{entry.research}</em>
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
