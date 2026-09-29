import Link from "next/link";
import { EvolutionGraph } from "@/components/EvolutionGraph";
import { ResearchEvolutionTimeline } from "@/components/ResearchEvolutionTimeline";
import { ResearchGraph } from "@/components/ResearchGraph";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";
import {
  buildResearchEvolutionProjection,
  loadManuscriptCitationProjection,
  mergeEvolutionProjections,
} from "@/lib/research/evolution.mjs";

type GraphView = "research" | "provenance" | "timeline";

function graphHref({ research, view, relation }: { research: string; view: GraphView; relation?: string }) {
  const params = new URLSearchParams({ research, view });
  if (relation) params.set("relation", relation);
  return `/graph?${params.toString()}`;
}

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ relation?: string; research?: string; view?: string }>;
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
  const typedCount = projectGraphEdges.filter((edge) => edge.explicit).length;
  const referenceCount = projectGraphEdges.length - typedCount;

  const researchEvolution = buildResearchEvolutionProjection(workspace, { projectId });
  let manuscript = {
    projectId,
    nodes: [],
    edges: [],
    unresolved: [],
    stats: { manuscriptFiles: 0, citations: 0, resolved: 0, ambiguous: 0, missing: 0 },
  };
  try {
    manuscript = await loadManuscriptCitationProjection({ projectId });
  } catch {
    // The graph remains useful before a manuscript workspace exists or when local manuscript files are unavailable.
  }
  const evolution = mergeEvolutionProjections(researchEvolution, manuscript);

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="graph" />
      <main className="collection-shell graph-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Research evolution</p>
            <h1>Trace how sources become evidence, claims, citations, and manuscript text.</h1>
            <p>
              Keep the force-directed semantic graph for research relationships, switch to provenance to follow source-to-manuscript paths,
              or use the timeline to compare dated research and explicit semantic versions. No graph layer invents relationships that are not already stored or resolved.
            </p>
          </div>
          <span className="collection-count">
            {evolution.stats.researchNodes} research · {evolution.stats.annotationNodes} annotations · {evolution.stats.citationNodes} citations · {evolution.stats.timelineEvents} dated events
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
                <div><span className="kicker">Trace health</span><h2>Manuscript citation resolution</h2></div>
              </div>
              <div className="relationship-index">
                <div className="relationship-index-row"><span>Resolved</span><strong>{manuscript.stats.resolved}</strong><span>citation links</span></div>
                <div className="relationship-index-row"><span>Ambiguous</span><strong>{manuscript.stats.ambiguous}</strong><span>require explicit choice</span></div>
                <div className="relationship-index-row"><span>Missing</span><strong>{manuscript.stats.missing}</strong><span>not linked</span></div>
                {manuscript.unresolved.slice(0, 12).map((item) => (
                  <div className="relationship-index-row" key={`${item.file}-${item.key}-${item.status}`}>
                    <span>{item.file}</span><strong>{item.key}</strong><span>{item.status}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {view === "timeline" && (
          <ResearchEvolutionTimeline nodes={evolution.nodes} timeline={evolution.timeline} lineages={evolution.lineages} />
        )}
      </main>
    </div>
  );
}
