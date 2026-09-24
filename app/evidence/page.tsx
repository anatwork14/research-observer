import Link from "next/link";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";
import { WorkspaceAssetUpload } from "@/components/WorkspaceAssetUpload";
import { EvidenceAssetPreview } from "@/components/EvidenceAssetPreview";
import { CollectionFilters } from "@/components/CollectionFilters";
import { CollectionView } from "@/components/CollectionView";
import { assetBelongsToResearch, matchesResearchText, researchAssetKind } from "@/lib/research/collection-filter.mjs";

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".bmp"]);
function assetUrl(path: string) { return "/_research/media/" + path.split("/").map(encodeURIComponent).join("/"); }
function paperUrl(path: string, page?: number) {
  const base = "/papers/" + path.split("/").map(encodeURIComponent).join("/");
  return page ? `${base}?page=${page}` : base;
}
function normalizeDoi(value?: string) {
  return (value ?? "")
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
}
function externalSourceUrl(source: { url?: string; doi?: string } | undefined) {
  if (source?.url && /^https:\/\//i.test(source.url)) return source.url;
  const doi = normalizeDoi(source?.doi);
  return doi ? `https://doi.org/${doi}` : undefined;
}

export default async function EvidencePage({ searchParams }: { searchParams: Promise<{ research?: string; q?: string; type?: string }> }) {
  const workspace = await getResearchWorkspace();
  const filters = await searchParams;
  const research = filters.research ?? "";
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const allEvidenceNotes = workspace.entries.filter((entry) => entry.type === "evidence");
  const evidenceAssetPaths = new Set(allEvidenceNotes.flatMap((entry) => entry.assets));
  const evidenceNotes = allEvidenceNotes.filter((entry) => {
    if (research && entry.research !== research) return false;
    if (!matchesResearchText([entry.title, entry.summary, entry.text, ...entry.tags], filters.q ?? "")) return false;
    const kinds = [
      ...(entry.source?.pdf ? ["paper"] : []),
      ...(entry.source?.kind === "consensus" ? ["consensus"] : []),
      ...entry.assets.map((asset) => researchAssetKind(workspace.assets.find((item) => item.path === asset)?.extension ?? "")),
    ];
    return !filters.type || kinds.includes(filters.type);
  });
  const artifacts = workspace.assets.filter((asset) => {
    if (asset.extension === ".pdf" && !evidenceAssetPaths.has(asset.path)) return false;
    if (!assetBelongsToResearch(asset.path, research, workspace)) return false;
    if (!matchesResearchText([asset.path, asset.path.replace(/[-_.]+/g, " ")], filters.q ?? "")) return false;
    return !filters.type || researchAssetKind(asset.extension) === filters.type;
  });
  const bySlug = new Map(workspace.entries.map((entry) => [entry.slug, entry]));
  const externalEvidence = evidenceNotes.filter((entry) => entry.source?.kind === "consensus" || entry.source?.url || entry.source?.doi || entry.source?.paperId);

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="evidence" />
      <main className="collection-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Evidence</p>
            <h1>Evidence and research artifacts</h1>
            <p>Browse project evidence, upload PDFs or images, and preview artifacts without leaving the workspace.</p>
          </div>
          <span className="collection-count">{evidenceNotes.length} evidence · {externalEvidence.length} external · {artifacts.length} assets</span>
        </header>

        <CollectionFilters
          query={filters.q}
          type={filters.type}
          typeOptions={[{ value: "paper", label: "PDF" }, { value: "image", label: "Image" }, { value: "consensus", label: "Consensus" }, { value: "other", label: "Other files" }]}
          placeholder="Filter evidence by title, summary, or file name…"
        />
        <WorkspaceAssetUpload mode="evidence" research={research} />

        <section className="dashboard-card panel">
          <div className="dashboard-card-heading">
            <div><span className="kicker">Evidence objects</span><h2>Saved evidence with provenance</h2></div>
            <Link href="/collections?q=type%3Aevidence">Open collection →</Link>
          </div>
          <CollectionView storageKey="research-observer-evidence-view" label="Evidence objects">
          <div className="evidence-object-grid">
            {evidenceNotes.map((entry) => {
              const external = externalSourceUrl(entry.source);
              const isConsensus = entry.source?.kind === "consensus" || Boolean(external) || Boolean(entry.source?.paperId);
              return (
                <article key={entry.slug} id={`evidence-${entry.slug}`} className="evidence-object-card">
                  <div className="evidence-object-topline">
                    <span>{isConsensus ? "Consensus" : entry.source?.page ? `p.${entry.source.page}` : entry.assets.length ? "Attached artifact" : "source?"}</span>
                    <em>{entry.status ?? "evidence"}</em>
                  </div>
                  <Link href={`/progress/${entry.slug}`} className="evidence-object-title">{entry.title}</Link>
                  <p>{entry.summary}</p>
                  <div className="evidence-source-actions">
                    <Link href={`/progress/${entry.slug}`} className="evidence-source-link">Open saved evidence →</Link>
                    {entry.source?.pdf && <Link href={paperUrl(entry.source.pdf, entry.source.page)} className="evidence-source-link">Open PDF source →</Link>}
                    {external && <a href={external} className="evidence-source-link" target="_blank" rel="noreferrer">Open paper source ↗</a>}
                  </div>
                  {isConsensus && (entry.source?.doi || entry.source?.paperId || entry.source?.query) && (
                    <div className="evidence-source-meta">
                      {entry.source.doi && <span>DOI {normalizeDoi(entry.source.doi)}</span>}
                      {entry.source.paperId && <span>Paper ID {entry.source.paperId}</span>}
                      {entry.source.query && <span>Search: {entry.source.query}</span>}
                    </div>
                  )}
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
              );
            })}
            {!evidenceNotes.length && (
              <div className="empty-evidence-object">
                <strong>No durable evidence objects yet.</strong>
                <span>Use <em>Add new...</em> to submit a PDF or image, or save a reviewed excerpt from a paper.</span>
              </div>
            )}
          </div>
          </CollectionView>
        </section>

        <header className="collection-subheading">
          <div><span className="kicker">Artifacts</span><h2>Figures, data, recordings, and files</h2></div>
          <span>{artifacts.length}</span>
        </header>

        <CollectionView storageKey="research-observer-evidence-view" label="Artifacts">
        <section className="evidence-grid">
          {artifacts.map((asset) => (
            <article key={asset.path} className="evidence-card panel">
              {imageExtensions.has(asset.extension) ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary research assets are not dimension-known at build time.
                <img src={assetUrl(asset.path)} alt={asset.path.split("/").pop() ?? "Research figure"} loading="lazy" />
              ) : asset.extension === ".pdf" ? (
                <div className="asset-placeholder">PDF</div>
              ) : (
                <div className="asset-placeholder">{asset.extension.replace(".", "").toUpperCase()}</div>
              )}
              <div>
                <strong>{asset.path.split("/").pop()}</strong><small>{asset.path} · {(asset.size / 1024).toFixed(0)} KB</small>
                {imageExtensions.has(asset.extension) || asset.extension === ".pdf"
                  ? <EvidenceAssetPreview src={assetUrl(asset.path)} name={asset.path.split("/").pop() ?? "Evidence artifact"} image={imageExtensions.has(asset.extension)} />
                  : <a className="asset-preview-trigger" href={assetUrl(asset.path)} target="_blank" rel="noreferrer">Open file ↗</a>}
              </div>
            </article>
          ))}
          {!artifacts.length && <div className="empty-collection panel"><h2>No evidence assets yet.</h2><p>Figures and data files referenced from Markdown will appear here.</p></div>}
        </section>
        </CollectionView>
      </main>
    </div>
  );
}
