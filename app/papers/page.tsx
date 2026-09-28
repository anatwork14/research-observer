import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";
import { WorkspaceAssetUpload } from "@/components/WorkspaceAssetUpload";
import { CollectionFilters } from "@/components/CollectionFilters";
import { CollectionView } from "@/components/CollectionView";
import { assetBelongsToResearch, matchesResearchText } from "@/lib/research/collection-filter.mjs";

function paperHref(path: string) {
  return "/papers/" + path.split("/").map(encodeURIComponent).join("/");
}

export default async function PapersPage({ searchParams }: { searchParams: Promise<{ research?: string; q?: string }> }) {
  const workspace = await getResearchWorkspace();
  const filters = await searchParams;
  const research = filters.research ?? "";
  const companionByPdf = new Map(
    workspace.entries
      .filter((entry) => entry.pdf && !/^https?:\/\//i.test(entry.pdf))
      .map((entry) => [entry.pdf as string, entry]),
  );
  const papers = workspace.assets.filter((asset) => {
    if (asset.extension !== ".pdf" || !assetBelongsToResearch(asset.path, research, workspace)) return false;
    const companion = companionByPdf.get(asset.path);
    return matchesResearchText([asset.path, asset.path.replace(/[-_.]+/g, " "), companion?.title, companion?.summary, ...companion?.authors ?? [], companion?.doi, companion?.year], filters.q ?? "");
  });
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="papers" />
      <main className="collection-shell">
        <header className="collection-heading">
          <div><p className="eyebrow">Papers</p><h1>PDF research library</h1><p>Read source material without leaving the research workspace.</p></div>
          <span className="collection-count">{papers.length} PDFs</span>
        </header>

        <CollectionFilters query={filters.q} placeholder="Filter PDFs by title, author, DOI, or file name…" />
        <WorkspaceAssetUpload mode="paper" research={research} />

        <CollectionView storageKey="research-observer-papers-view" label="Papers" >
        <section className="paper-grid">
          {papers.map((paper) => {
            const companion = companionByPdf.get(paper.path);
            return (
              <Link key={paper.path} href={`${paperHref(paper.path)}${research ? `?research=${encodeURIComponent(research)}` : ""}`} className="paper-card panel">
                <span className="paper-icon">PDF</span>
                <div>
                  <strong>{companion?.title ?? paper.path.split("/").pop()?.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ")}</strong>
                  <small>{companion?.authors.length ? companion.authors.join(", ") : paper.path}</small>
                  {companion && <span className="paper-meta-line">{[companion.year, companion.doi].filter(Boolean).join(" · ") || companion.summary}</span>}
                </div>
                <em>{(paper.size / 1024 / 1024).toFixed(1)} MB</em>
              </Link>
            );
          })}
          {!papers.length && <div className="empty-collection panel"><h2>No PDFs match this view.</h2><p>Use <em>Add new...</em> to upload a PDF, or clear the project and search filters.</p></div>}
        </section>
        </CollectionView>
      </main>
    </div>
  );
}
