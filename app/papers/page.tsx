import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";

function paperHref(path: string) {
  return "/papers/" + path.split("/").map(encodeURIComponent).join("/");
}

export default async function PapersPage() {
  const workspace = await getResearchWorkspace();
  const papers = workspace.assets.filter((asset) => asset.extension === ".pdf");
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="papers" />
      <main className="collection-shell">
        <header className="collection-heading">
          <div><p className="eyebrow">Papers</p><h1>PDF research library</h1><p>Read source material without leaving the research workspace.</p></div>
          <span className="collection-count">{papers.length} PDFs</span>
        </header>

        <section className="paper-grid">
          {papers.map((paper) => (
            <Link key={paper.path} href={paperHref(paper.path)} className="paper-card panel">
              <span className="paper-icon">PDF</span>
              <div><strong>{paper.path.split("/").pop()?.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ")}</strong><small>{paper.path}</small></div>
              <em>{(paper.size / 1024 / 1024).toFixed(1)} MB</em>
            </Link>
          ))}
          {!papers.length && <div className="empty-collection panel"><h2>No PDFs yet.</h2><p>Add a PDF under <code>progress/papers/</code> and reference it from a research note.</p></div>}
        </section>
      </main>
    </div>
  );
}
