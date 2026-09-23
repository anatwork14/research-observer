import Link from "next/link";
import { ResearchGraph } from "@/components/ResearchGraph";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ relation?: string }>;
}) {
  const workspace = await getResearchWorkspace();
  const filters = await searchParams;
  const relationTypes = [...new Set(workspace.graph.edges.filter((edge) => edge.explicit).map((edge) => edge.type))].sort();
  const edges = filters.relation
    ? workspace.graph.edges.filter((edge) => edge.type === filters.relation)
    : workspace.graph.edges;
  const participating = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const nodes = filters.relation
    ? workspace.graph.nodes.filter((node) => participating.has(node.slug))
    : workspace.graph.nodes;
  const entriesBySlug = new Map(workspace.entries.map((entry) => [entry.slug, entry]));
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const typedCount = workspace.graph.edges.filter((edge) => edge.explicit).length;
  const referenceCount = workspace.graph.edges.length - typedCount;

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="graph" />
      <main className="collection-shell graph-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Graph</p>
            <h1>Explore research meaning, not just backlinks.</h1>
            <p>
              Drag and pin nodes, pan/zoom, focus a local neighborhood, and tune force layout. Solid edges are explicit typed research relationships;
              dashed edges are ordinary Markdown references so evidence semantics stay distinguishable from simple mentions.
            </p>
          </div>
          <span className="collection-count">{typedCount} typed · {referenceCount} references · {workspace.graph.nodes.length} nodes</span>
        </header>

        <nav className="graph-filters panel" aria-label="Relationship filters">
          <Link href="/graph" className={!filters.relation ? "active" : undefined}>All relationships</Link>
          {relationTypes.map((type) => (
            <Link key={type} href={`/graph?relation=${encodeURIComponent(type)}`} className={filters.relation === type ? "active" : undefined}>
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
      </main>
    </div>
  );
}
