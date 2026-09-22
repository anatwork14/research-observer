import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".bmp"]);
function assetUrl(path: string) { return "/_research/media/" + path.split("/").map(encodeURIComponent).join("/"); }
function paperUrl(path: string, page?: number) {
  const base = "/papers/" + path.split("/").map(encodeURIComponent).join("/");
  return page ? `${base}?page=${page}` : base;
}

export default async function EvidencePage() {
  const workspace = await getResearchWorkspace();
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const evidenceNotes = workspace.entries.filter((entry) => entry.type === "evidence");
  const artifacts = workspace.assets.filter((asset) => asset.extension !== ".pdf");
  const bySlug = new Map(workspace.entries.map((entry) => [entry.slug, entry]));

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="evidence" />
      <main className="collection-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Evidence</p>
            <h1>Evidence and research artifacts</h1>
            <p>Durable PDF excerpts carry page provenance and typed relationships; figures and data remain source-linked assets.</p>
          </div>
          <span className="collection-count">{evidenceNotes.length} evidence · {artifacts.length} assets</span>
        </header>

        <section className="dashboard-card panel">
          <div className="dashboard-card-heading">
            <div><span className="kicker">Evidence objects</span><h2>PDF excerpts with provenance</h2></div>
            <Link href="/collections?q=type%3Aevidence">Open collection →</Link>
          </div>
          <div className="evidence-object-grid">
            {evidenceNotes.map((entry) => (
              <article key={entry.slug} className="evidence-object-card">
                <div className="evidence-object-topline">
                  <span>{entry.source?.page ? `p.${entry.source.page}` : "source?"}</span>
                  <em>{entry.status ?? "evidence"}</em>
                </div>
                <Link href={`/progress/${entry.slug}`} className="evidence-object-title">{entry.title}</Link>
                <p>{entry.summary}</p>
                {entry.source?.pdf && <Link href={paperUrl(entry.source.pdf, entry.source.page)} className="evidence-source-link">Open PDF source →</Link>}
                <div className="evidence-relations">
                  {entry.relationships.map((relation, index) => {
                    const target = bySlug.get(relation.target);
                    return target ? (
                      <Link key={`${relation.type}-${relation.target}-${index}`} href={`/progress/${target.slug}`}>
                        <em>{relation.type}</em>{target.title}
                      </Link>
                    ) : null;
                  })}
                </div>
              </article>
            ))}
            {!evidenceNotes.length && (
              <div className="empty-evidence-object">
                <strong>No durable evidence objects yet.</strong>
                <span>Open a PDF, select text, and choose <em>Add evidence</em>.</span>
              </div>
            )}
          </div>
        </section>

        <header className="collection-subheading">
          <div><span className="kicker">Artifacts</span><h2>Figures, data, recordings, and files</h2></div>
          <span>{artifacts.length}</span>
        </header>

        <section className="evidence-grid">
          {artifacts.map((asset) => (
            <a key={asset.path} href={assetUrl(asset.path)} className="evidence-card panel" target="_blank" rel="noreferrer">
              {imageExtensions.has(asset.extension) ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary research assets are not dimension-known at build time.
                <img src={assetUrl(asset.path)} alt={asset.path.split("/").pop() ?? "Research figure"} loading="lazy" />
              ) : (
                <div className="asset-placeholder">{asset.extension.replace(".", "").toUpperCase()}</div>
              )}
              <div><strong>{asset.path.split("/").pop()}</strong><small>{asset.path} · {(asset.size / 1024).toFixed(0)} KB</small></div>
            </a>
          ))}
          {!artifacts.length && <div className="empty-collection panel"><h2>No evidence assets yet.</h2><p>Figures and data files referenced from Markdown will appear here.</p></div>}
        </section>
      </main>
    </div>
  );
}
