type GraphNode = {
  slug: string;
  title: string;
  type?: string;
  status?: string;
  order: number;
};

type GraphEdge = {
  source: string;
  target: string;
  type: string;
  explicit: boolean;
};

function truncate(value: string, length = 24) {
  return value.length > length ? value.slice(0, length - 1) + "…" : value;
}

export function ResearchGraph({
  nodes,
  edges,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}) {
  const visibleNodes = nodes.slice(0, 36);
  const visibleSlugs = new Set(visibleNodes.map((node) => node.slug));
  const visibleEdges = edges.filter((edge) => visibleSlugs.has(edge.source) && visibleSlugs.has(edge.target));
  const width = 980;
  const height = Math.max(520, Math.ceil(visibleNodes.length / 8) * 140 + 120);
  const columns = Math.min(8, Math.max(1, visibleNodes.length));
  const rows = Math.max(1, Math.ceil(visibleNodes.length / columns));
  const xGap = width / (columns + 1);
  const yGap = (height - 80) / (rows + 1);
  const position = new Map(
    visibleNodes.map((node, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return [node.slug, { x: Math.round((column + 1) * xGap), y: Math.round(50 + (row + 1) * yGap) }];
    }),
  );

  return (
    <div className="graph-canvas panel" role="img" aria-label="Typed research relationship graph">
      <svg viewBox={`0 0 ${width} ${height}`} className="research-graph-svg">
        <defs>
          <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" className="graph-arrow" />
          </marker>
        </defs>

        {visibleEdges.map((edge, index) => {
          const source = position.get(edge.source);
          const target = position.get(edge.target);
          if (!source || !target) return null;
          return (
            <g key={`${edge.source}-${edge.type}-${edge.target}-${index}`}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={`graph-edge ${edge.explicit ? "explicit" : "implicit"}`}
                markerEnd="url(#graph-arrow)"
              />
              {edge.explicit && (
                <text
                  x={(source.x + target.x) / 2}
                  y={(source.y + target.y) / 2 - 5}
                  className="graph-edge-label"
                  textAnchor="middle"
                >
                  {edge.type}
                </text>
              )}
            </g>
          );
        })}

        {visibleNodes.map((node) => {
          const point = position.get(node.slug)!;
          return (
            <a key={node.slug} href={`/progress/${node.slug}`} aria-label={node.title}>
              <g className="graph-node">
                <circle cx={point.x} cy={point.y} r="28" />
                <text x={point.x} y={point.y + 4} textAnchor="middle" className="graph-node-order">
                  {String(node.order).padStart(2, "0")}
                </text>
                <text x={point.x} y={point.y + 47} textAnchor="middle" className="graph-node-title">
                  {truncate(node.title)}
                </text>
                <text x={point.x} y={point.y + 61} textAnchor="middle" className="graph-node-type">
                  {node.type ?? "note"}
                </text>
              </g>
            </a>
          );
        })}
      </svg>

      {nodes.length > visibleNodes.length && (
        <p className="graph-limit">
          Showing the first {visibleNodes.length} nodes for readability. Use typed filters or the relationship index below for the full workspace.
        </p>
      )}
    </div>
  );
}
