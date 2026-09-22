import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".bmp"]);
function assetUrl(path: string) { return "/_research/media/" + path.split("/").map(encodeURIComponent).join("/"); }

export default async function EvidencePage() {
  const workspace = await getResearchWorkspace();
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const evidence = workspace.assets.filter((asset) => asset.extension !== ".pdf");

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="evidence" />
      <main className="collection-shell">
        <header className="collection-heading">
          <div><p className="eyebrow">Evidence</p><h1>Research artifacts</h1><p>Figures, data files, recordings, and generated evidence referenced by the research.</p></div>
          <span className="collection-count">{evidence.length} assets</span>
        </header>

        <section className="evidence-grid">
          {evidence.map((asset) => (
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
          {!evidence.length && <div className="empty-collection panel"><h2>No evidence assets yet.</h2><p>Figures and data files referenced from Markdown will appear here.</p></div>}
        </section>
      </main>
    </div>
  );
}
