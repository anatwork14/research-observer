export function mergeEvolutionLayers(research, ...layers) {
  const nodes = new Map((research.nodes || []).map((node) => [node.id, node]));
  for (const layer of layers) {
    for (const node of layer?.nodes || []) if (!nodes.has(node.id)) nodes.set(node.id, node);
  }

  const nodeIds = new Set(nodes.keys());
  const edges = [research.edges || [], ...layers.map((layer) => layer?.edges || [])]
    .flat()
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const timeline = [research.timeline || [], ...layers.map((layer) => layer?.timeline || [])]
    .flat()
    .sort((a, b) => a.at.localeCompare(b.at) || a.label.localeCompare(b.label));
  const nodeList = [...nodes.values()];

  return {
    ...research,
    nodes: nodeList,
    edges,
    timeline,
    layers,
    stats: {
      ...research.stats,
      manuscriptNodes: nodeList.filter((node) => node.kind === "manuscript").length,
      citationNodes: nodeList.filter((node) => node.kind === "citation").length,
      revisionNodes: nodeList.filter((node) => node.kind === "revision").length,
      citationEdges: edges.filter((edge) => edge.layer === "citation").length,
      revisionEdges: edges.filter((edge) => edge.type === "revised_in").length,
      timelineEvents: timeline.length,
    },
  };
}
