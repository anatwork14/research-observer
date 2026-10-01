import Link from "next/link";
import { EvolutionGraph } from "@/components/EvolutionGraph";
import { ManuscriptClaimHistory } from "@/components/ManuscriptClaimHistory";
import { ResearchEvolutionTimeline } from "@/components/ResearchEvolutionTimeline";
import { ResearchGraph } from "@/components/ResearchGraph";
import { ResearchVersionCompare } from "@/components/ResearchVersionCompare";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";
import { mergeEvolutionLayers } from "@/lib/research/evolution-merge.mjs";
import {
  buildResearchEvolutionProjection,
  loadManuscriptCitationProjection,
  type ManuscriptCitationProjection,
} from "@/lib/research/evolution.mjs";
import {
  loadManuscriptClaimEvolution,
  type ManuscriptClaimEvolution,
} from "@/lib/research/manuscript-claim-history.mjs";
import {
  loadManuscriptClaimProjection,
  type ManuscriptClaimProjection,
} from "@/lib/research/manuscript-claim-projection.mjs";
import { buildManuscriptRevisionProjection } from "@/lib/research/manuscript-evolution.mjs";
import { listManuscriptRevisions } from "@/lib/research/manuscript-history.mjs";
import { buildResearchVersionComparisons } from "@/lib/research/version-compare.mjs";
import { orderVersionLineages } from "@/lib/research/version-lineage.mjs";

type GraphView = "research" | "provenance" | "timeline";

function graphHref({ research, view, relation }: { research: string; view: GraphView; relation?: string }) {
  const params = new URLSearchParams({ research, view });
  if (relation) params.set("relation", relation);
  return `/graph?${params.toString()}`;
}

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{
    relation?: string;
    research?: string;
    view?: string;
    claimBase?: string;
    claimCompare?: string;
    claimHistory?: string;
    evidenceHistory?: string;
  }>;
}) {
  const workspace = await getResearchWorkspace();
  const filters = await searchParams;
  const projectId = workspace.projects.some((project) => project.id === filters.research)
    ? filters.research!
    : workspace.projects.find((project) => project.id === "default")?.id ?? workspace.projects[0]?.id ?? "default";
  const view: GraphView = filters.view === "provenance" || filters.view === "timeline" ? filters.view : "research";
  const projectSlugs = new Set(workspace.entries.filter((entry) => entry.research === projectId).map((entry) => entry.slug));
  const projectGraphNodes = workspace.graph.nodes.filter((node) => projectSlugs.has(node.slug));
  const projectGraphEdges = workspace.graph.edges.filter((edge) => projectSlugs.has(edge.source) && projectSlugs.has(edge.target));
  const typedCount = projectGraphEdges.filter((edge) => edge.explicit).length;
  const referenceCount = projectGraphEdges.length - typedCount;
  const relationTypes = [...new Set(projectGraphEdges.filter((edge) => edge.explicit).map((edge) => edge.type))].sort();
  const edges = filters.relation
    ? projectGraphEdges.filter((edge) => edge.type === filters.relation)
    : projectGraphEdges;
  const participating = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const nodes = filters.relation
    ? projectGraphNodes.filter((node) => participating.has(node.slug))
    : projectGraphNodes;
  const entriesBySlug = new Map(workspace.entries.map((entry) => [entry.slug, entry]));
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));

  const baseResearchEvolution = buildResearchEvolutionProjection(workspace, { projectId });
  const researchEvolution = {
    ...baseResearchEvolution,
    lineages: orderVersionLineages(baseResearchEvolution.lineages, baseResearchEvolution.edges, baseResearchEvolution.nodes),
  };
  const versionComparisons = view === "timeline" ? buildResearchVersionComparisons(workspace, { projectId }) : [];

  let manuscript: ManuscriptCitationProjection = {
    projectId,
    nodes: [],
    edges: [],
    unresolved: [],
    stats: { manuscriptFiles: 0, passages: 0, citations: 0, resolved: 0, ambiguous: 0, missing: 0 },
  };
  let claims: ManuscriptClaimProjection = {
    projectId,
    nodes: [],
    edges: [],
    issues: [],
    relationIssues: [],
    stats: {
      manuscriptFiles: 0,
      claims: 0,
      claimIssues: 0,
      duplicates: 0,
      invalid: 0,
      orphan: 0,
      relations: 0,
      relationIssues: 0,
      relationDuplicates: 0,
      relationUnresolved: 0,
    },
  };
  let claimHistory: ManuscriptClaimEvolution = {
    projectId,
    snapshots: [],
    transitions: [],
    dirtyFiles: [],
    available: false,
    stats: { revisions: 0, transitions: 0, events: 0 },
  };
  let manuscriptStateDirty = false;
  let citationAvailable = view === "research" ? null : false;
  let claimAvailable = view === "provenance" ? false : null;
  let revisions = buildManuscriptRevisionProjection({
    projectId,
    history: { projectId, projectPath: "", revisions: [], dirtyFiles: [], stateDirty: false, available: false },
  });

  if (view !== "research") {
    const claimRequest = view === "provenance"
      ? loadManuscriptClaimProjection({ projectId, researchEntries: workspace.entries })
      : Promise.resolve<ManuscriptClaimProjection | null>(null);
    const [citationResult, historyResult, claimResult] = await Promise.allSettled([
      loadManuscriptCitationProjection({ projectId }),
      listManuscriptRevisions({ projectId, includeStateChanges: view === "timeline" }),
      claimRequest,
    ]);
    if (citationResult.status === "fulfilled") {
      manuscript = citationResult.value;
      citationAvailable = citationResult.value.stats.manuscriptFiles > 0;
    }
    if (claimResult.status === "fulfilled" && claimResult.value) {
      claims = claimResult.value;
      claimAvailable = claimResult.value.stats.manuscriptFiles > 0;
    }
    const manuscriptHistory = historyResult.status === "fulfilled"
      ? historyResult.value
      : { projectId, projectPath: "", revisions: [], dirtyFiles: [], stateDirty: false, available: false };
    manuscriptStateDirty = Boolean(manuscriptHistory.stateDirty);
    revisions = buildManuscriptRevisionProjection({ projectId, history: manuscriptHistory });
    if (view === "timeline" && historyResult.status === "fulfilled") {
      try {
        claimHistory = await loadManuscriptClaimEvolution({
          projectId,
          researchEntries: workspace.entries,
          history: manuscriptHistory,
        });
      } catch {
        claimHistory = { projectId, snapshots: [], transitions: [], dirtyFiles: manuscriptHistory.dirtyFiles, available: false, stats: { revisions: 0, transitions: 0, events: 0 } };
      }
    }
  }

  const manuscriptHistoryAvailable = manuscript.stats.manuscriptFiles > 0 && revisions.available;
  const evolution = mergeEvolutionLayers(researchEvolution, manuscript, claims, revisions);

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="graph" />
      <main className="collection-shell graph-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Research evolution</p>
            <h1>Trace sources, evidence, citations, explicit manuscript claims, and revisions.</h1>
            <p>
              Keep the force-directed semantic graph for canonical research relationships, switch to provenance to follow source-to-manuscript paths and explicitly authored Claim↔Evidence semantics,
              or use the timeline to compare dated research, explicit semantic versions, real committed manuscript revisions, and historical authored Claim/Evidence state. Passage context is literal saved LaTeX structure; Claim nodes and Claim↔Evidence links exist only when the manuscript author writes their explicit Observaire directives.
            </p>
          </div>
          <span className="collection-count">
            {view === "research"
              ? `${typedCount} typed · ${referenceCount} references · ${projectGraphNodes.length} nodes`
              : `${evolution.stats.researchNodes} research · ${evolution.stats.annotationNodes} annotations · ${citationAvailable ? `${evolution.stats.citationNodes} citations · ${evolution.stats.passageNodes} passages` : "citation scan unavailable"}${view === "provenance" ? claimAvailable ? ` · ${evolution.stats.claimNodes} explicit claims · ${claims.stats.relations} claim-evidence links` : " · claim scan unavailable" : ""} · ${manuscriptHistoryAvailable ? `${evolution.stats.revisionNodes} revisions` : "Git history unavailable"} · ${evolution.stats.timelineEvents} dated events`}
          </span>
        </header>

        <nav className="graph-filters panel" aria-label="Graph views">
          <Link href={graphHref({ research: projectId, view: "research" })} className={view === "research" ? "active" : undefined}>Research graph</Link>
          <Link href={graphHref({ research: projectId, view: "provenance" })} className={view === "provenance" ? "active" : undefined}>Provenance</Link>
          <Link href={graphHref({ research: projectId, view: "timeline" })} className={view === "timeline" ? "active" : undefined}>Timeline & versions</Link>
        </nav>

        {view === "research" && (
          <>
            <nav className="graph-filters panel" aria-label="Relationship filters">
              <Link href={graphHref({ research: projectId, view: "research" })} className={!filters.relation ? "active" : undefined}>All relationships</Link>
              {relationTypes.map((type) => (
                <Link key={type} href={graphHref({ research: projectId, view: "research", relation: type })} className={filters.relation === type ? "active" : undefined}>
                  {type}
                </Link>
              ))}
            </nav>

            <ResearchGraph nodes={nodes} edges={edges} />

            <section className="graph-index panel">
              <div className="dashboard-card-heading">
                <div><span className="kicker">Relationship index</span><h2>{filters.relation ?? "All explicit relationships"}</h2></div>
              </div>
              <div className="relationship-index">
                {edges.filter((edge) => edge.explicit).map((edge, index) => {
                  const source = entriesBySlug.get(edge.source);
                  const target = entriesBySlug.get(edge.target);
                  if (!source || !target) return null;
                  return (
                    <div className="relationship-index-row" key={`${edge.source}-${edge.type}-${edge.target}-${index}`}>
                      <Link href={`/progress/${source.slug}`}>{source.title}</Link>
                      <span>{edge.type}</span>
                      <Link href={`/progress/${target.slug}`}>{target.title}</Link>
                    </div>
                  );
                })}
                {!edges.some((edge) => edge.explicit) && <p className="quiet">No typed relationships match this view yet.</p>}
              </div>
            </section>
          </>
        )}

        {view === "provenance" && (
          <>
            <EvolutionGraph nodes={evolution.nodes} edges={evolution.edges} />
            <section className="graph-index panel">
              <div className="dashboard-card-heading">
                <div><span className="kicker">Trace health</span><h2>Manuscript linkage, authored Claim semantics, and revision state</h2></div>
              </div>
              <div className="relationship-index">
                <div className="relationship-index-row"><span>Citation scan</span><strong>{citationAvailable ? "Available" : "Unavailable"}</strong><span>{citationAvailable ? `${manuscript.stats.citations} occurrences` : "research graph remains usable"}</span></div>
                <div className="relationship-index-row"><span>Passages</span><strong>{citationAvailable ? manuscript.stats.passages : "—"}</strong><span>literal saved LaTeX blocks</span></div>
                <div className="relationship-index-row"><span>Explicit claims</span><strong>{claimAvailable ? claims.stats.claims : "—"}</strong><span>user-authored Claim anchors only</span></div>
                <div className="relationship-index-row"><span>Claim issues</span><strong>{claimAvailable ? claims.stats.claimIssues : "—"}</strong><span>{claimAvailable ? "duplicate, invalid, or orphan anchors" : "claim scan unavailable"}</span></div>
                <div className="relationship-index-row"><span>Claim ↔ evidence</span><strong>{claimAvailable ? claims.stats.relations : "—"}</strong><span>explicit manuscript directives only</span></div>
                <div className="relationship-index-row"><span>Evidence-link issues</span><strong>{claimAvailable ? claims.stats.relationIssues : "—"}</strong><span>{claimAvailable ? "malformed, duplicate, or unresolved authored links" : "claim scan unavailable"}</span></div>
                <div className="relationship-index-row"><span>Resolved citations</span><strong>{citationAvailable ? manuscript.stats.resolved : "—"}</strong><span>citation links</span></div>
                <div className="relationship-index-row"><span>Ambiguous citations</span><strong>{citationAvailable ? manuscript.stats.ambiguous : "—"}</strong><span>require explicit choice</span></div>
                <div className="relationship-index-row"><span>Missing citations</span><strong>{citationAvailable ? manuscript.stats.missing : "—"}</strong><span>not linked</span></div>
                <div className="relationship-index-row"><span>Committed revisions</span><strong>{manuscriptHistoryAvailable ? revisions.stats.revisions : "Unavailable"}</strong><span>{manuscriptHistoryAvailable ? "Git history" : "manuscript history unavailable"}</span></div>
                <div className="relationship-index-row"><span>Working changes</span><strong>{manuscriptHistoryAvailable ? revisions.stats.dirtyFiles : "Unavailable"}</strong><span>not presented as revisions</span></div>
                {claims.relationIssues.slice(0, 12).map((item, index) => (
                  <div className="relationship-index-row" key={`claim-evidence-${item.file ?? "?"}-${item.line ?? "?"}-${item.claimId ?? "?"}-${item.evidenceSlug ?? "?"}-${item.type}-${index}`}>
                    <span>{item.line ? `${item.file ?? "manuscript"}:${item.line}` : item.file ?? "manuscript"}</span>
                    <strong>{[item.claimId, item.relation, item.evidenceSlug].filter(Boolean).join(" ") || "invalid relation"}</strong>
                    <span>{item.type}</span>
                  </div>
                ))}
                {claims.issues.slice(0, 12).map((item, index) => (
                  <div className="relationship-index-row" key={`claim-${item.file ?? "?"}-${item.line ?? "?"}-${item.claimId ?? "?"}-${item.type}-${index}`}>
                    <span>{item.line ? `${item.file ?? "manuscript"}:${item.line}` : item.file ?? "manuscript"}</span><strong>{item.claimId ?? "invalid claim"}</strong><span>{item.type}</span>
                  </div>
                ))}
                {manuscript.unresolved.slice(0, 12).map((item) => (
                  <div className="relationship-index-row" key={`${item.file}-${item.line ?? "?"}-${item.key}-${item.status}-${item.start}`}>
                    <span>{item.line ? `${item.file}:${item.line}` : item.file}</span><strong>{item.key}</strong><span>{[item.status, item.section].filter(Boolean).join(" · ")}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {view === "timeline" && (
          <>
            <ResearchEvolutionTimeline nodes={evolution.nodes} timeline={evolution.timeline} lineages={evolution.lineages} />
            <ResearchVersionCompare comparisons={versionComparisons} />
            <ManuscriptClaimHistory
              evolution={claimHistory}
              projectId={projectId}
              baseCommit={filters.claimBase}
              compareCommit={filters.claimCompare}
              claimId={filters.claimHistory}
              evidenceSlug={filters.evidenceHistory}
              stateDirty={manuscriptStateDirty}
            />
          </>
        )}
      </main>
    </div>
  );
}