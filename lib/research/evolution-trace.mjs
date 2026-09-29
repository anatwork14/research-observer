export function traceEvolutionNeighborhood(edges = [], start = "", maxDepth = 6) {
  const root = String(start || "");
  if (!root) return new Set();
  const depthLimit = Number.isInteger(maxDepth) ? Math.max(0, Math.min(12, maxDepth)) : 6;
  const adjacency = new Map();
  for (const edge of edges) {
    if (!edge?.source || !edge?.target) continue;
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  }

  const visited = new Set([root]);
  let frontier = [root];
  for (let depth = 0; depth < depthLimit && frontier.length; depth += 1) {
    const next = [];
    for (const current of frontier) {
      for (const neighbor of adjacency.get(current) || []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return visited;
}
