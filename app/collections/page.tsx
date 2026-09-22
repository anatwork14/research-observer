import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { filterResearchEntries } from "@/lib/research/query.mjs";
import { getResearchWorkspace } from "@/lib/progress";

const defaultCollections = [
  { id: "active", label: "Active research", description: "Everything not marked complete or archived.", query: "-status:complete -status:archived" },
  { id: "questions", label: "Questions", description: "Research questions across the workspace.", query: "type:question" },
  { id: "validating", label: "Validating experiments", description: "Experiments currently in validation.", query: "type:experiment status:validating" },
  { id: "papers", label: "Literature with PDFs", description: "Literature notes backed by local papers.", query: "type:literature has:pdf" },
  { id: "evidence", label: "PDF evidence", description: "Durable evidence objects with page/source provenance.", query: "type:evidence has:source" },
  { id: "contradictions", label: "Contradictions", description: "Research objects connected through contradiction relationships.", query: "relationship:contradicts" },
];

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) {
  const workspace = await getResearchWorkspace();
  const params = await searchParams;
  const saved = Array.isArray(workspace.config.savedCollections)
    ? workspace.config.savedCollections as Array<{ id: string; label: string; description?: string; query: string }>
    : defaultCollections;
  const selected = params.view ? saved.find((view) => view.id === params.view) : undefined;
  const query = params.q ?? selected?.query ?? "";
  const visible = filterResearchEntries(workspace.entries, query);
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="collections" />
      <main className="collection-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Collections</p>
            <h1>Deterministic research views</h1>
            <p>Saved queries update automatically as Markdown, provenance, and typed relationships change.</p>
          </div>
          <span className="collection-count">{visible.length} / {workspace.entries.length}</span>
        </header>

        <section className="collection-query-panel panel">
          <form action="/collections" method="get" className="collection-query-form">
            <label htmlFor="research-query">Advanced search</label>
            <div>
              <input id="research-query" name="q" defaultValue={query} placeholder='type:experiment status:validating tag:retrieval' />
              <button type="submit">Search</button>
            </div>
          </form>
          <div className="query-help">
            <code>type:</code><code>status:</code><code>research:</code><code>tag:</code><code>author:</code><code>has:pdf</code><code>has:source</code><code>relationship:</code><code>target:</code><code>after:</code><code>before:</code><code>-status:</code>
          </div>
        </section>

        <section className="saved-collection-grid" aria-label="Saved collections">
          {saved.map((view) => {
            const count = filterResearchEntries(workspace.entries, view.query).length;
            return (
              <Link key={view.id} href={`/collections?view=${encodeURIComponent(view.id)}`} className={`saved-collection-card panel ${selected?.id === view.id ? "active" : ""}`}>
                <span>{view.label}</span>
                <strong>{count}</strong>
                <small>{view.description ?? view.query}</small>
                <code>{view.query}</code>
              </Link>
            );
          })}
        </section>

        <section className="note-index panel collection-results">
          {visible.map((entry) => (
            <Link key={entry.slug} href={`/progress/${entry.slug}`} className="note-index-row">
              <span className="note-index-order">{String(entry.order).padStart(2, "0")}</span>
              <span className="note-index-copy">
                <strong>{entry.title}</strong>
                <small>{entry.summary || entry.filename}</small>
              </span>
              <span className="note-index-meta">
                <em>{entry.research}</em>
                {entry.type && <em>{entry.type}</em>}
                {entry.status && <em>{entry.status}</em>}
                {entry.relationships.length > 0 && <small>{entry.relationships.length} relations</small>}
              </span>
            </Link>
          ))}
          {!visible.length && <p className="quiet">No research objects match <code>{query || "(empty query)"}</code>.</p>}
        </section>
      </main>
    </div>
  );
}
