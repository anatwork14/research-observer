function stableNodeCompare(byId, a, b) {
  const left = byId.get(a) || {};
  const right = byId.get(b) || {};
  const leftDate = left.date || "";
  const rightDate = right.date || "";
  return leftDate.localeCompare(rightDate) ||
    (left.order ?? 0) - (right.order ?? 0) ||
    String(left.label || a).localeCompare(String(right.label || b));
}

export function orderVersionLineages(lineages = [], edges = [], nodes = []) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const versionEdges = edges.filter((edge) => edge.layer === "version" && edge.type === "supersedes");

  return lineages.map((lineage) => {
    const memberSet = new Set(lineage.members);
    const relevant = versionEdges.filter((edge) => memberSet.has(edge.source) && memberSet.has(edge.target));
    const reverseAdjacency = new Map(lineage.members.map((id) => [id, []]));
    const indegree = new Map(lineage.members.map((id) => [id, 0]));
    const originalIncoming = new Map(lineage.members.map((id) => [id, 0]));
    const originalOutgoing = new Map(lineage.members.map((id) => [id, 0]));

    for (const edge of relevant) {
      // Stored semantics: source is the newer version and supersedes target (older).
      // Display semantics: reverse that edge so the lineage reads oldest → newest.
      reverseAdjacency.get(edge.target)?.push(edge.source);
      indegree.set(edge.source, (indegree.get(edge.source) || 0) + 1);
      originalOutgoing.set(edge.source, (originalOutgoing.get(edge.source) || 0) + 1);
      originalIncoming.set(edge.target, (originalIncoming.get(edge.target) || 0) + 1);
    }

    for (const list of reverseAdjacency.values()) list.sort((a, b) => stableNodeCompare(byId, a, b));
    const queue = lineage.members.filter((id) => (indegree.get(id) || 0) === 0).sort((a, b) => stableNodeCompare(byId, a, b));
    const ordered = [];
    while (queue.length) {
      const current = queue.shift();
      ordered.push(current);
      for (const next of reverseAdjacency.get(current) || []) {
        indegree.set(next, (indegree.get(next) || 0) - 1);
        if (indegree.get(next) === 0) {
          queue.push(next);
          queue.sort((a, b) => stableNodeCompare(byId, a, b));
        }
      }
    }

    const cyclic = ordered.length !== lineage.members.length || Boolean(lineage.cyclic);
    const members = cyclic
      ? lineage.members.slice().sort((a, b) => stableNodeCompare(byId, a, b))
      : ordered;

    return {
      ...lineage,
      members,
      cyclic,
      oldest: lineage.members.filter((id) => (originalOutgoing.get(id) || 0) === 0),
      newest: lineage.members.filter((id) => (originalIncoming.get(id) || 0) === 0),
    };
  });
}
