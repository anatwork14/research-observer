const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function graphDegreeMap(nodes, edges) {
  const degree = new Map(nodes.map((node) => [node.slug, 0]));
  for (const edge of edges) {
    if (degree.has(edge.source)) degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    if (degree.has(edge.target)) degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  return degree;
}

export function graphNeighborhood(edges, root, depth = 1, { explicitOnly = false } = {}) {
  if (!root || depth < 0) return new Set();
  const adjacency = new Map();
  for (const edge of edges) {
    if (explicitOnly && !edge.explicit) continue;
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  }

  const seen = new Set([root]);
  let frontier = new Set([root]);
  for (let step = 0; step < depth; step += 1) {
    const next = new Set();
    for (const slug of frontier) {
      for (const neighbor of adjacency.get(slug) ?? []) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        next.add(neighbor);
      }
    }
    frontier = next;
    if (!frontier.size) break;
  }
  return seen;
}

export function initialGraphPositions(nodes) {
  const projects = new Map();
  for (const node of nodes) {
    const project = node.research || "default";
    if (!projects.has(project)) projects.set(project, []);
    projects.get(project).push(node);
  }

  const projectEntries = [...projects.entries()].sort(([a], [b]) => a.localeCompare(b));
  const positions = {};
  const projectRadius = projectEntries.length <= 1 ? 0 : Math.max(260, 130 * projectEntries.length);

  projectEntries.forEach(([, projectNodes], projectIndex) => {
    const angle = projectEntries.length <= 1 ? 0 : (Math.PI * 2 * projectIndex) / projectEntries.length - Math.PI / 2;
    const cx = Math.cos(angle) * projectRadius;
    const cy = Math.sin(angle) * projectRadius * 0.68;
    const localScale = Math.max(90, Math.min(260, 52 * Math.sqrt(projectNodes.length)));

    projectNodes
      .slice()
      .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
      .forEach((node, index) => {
        if (index === 0) {
          positions[node.slug] = { x: cx, y: cy };
          return;
        }
        const radius = Math.min(localScale, 48 + 34 * Math.sqrt(index));
        const localAngle = index * GOLDEN_ANGLE;
        positions[node.slug] = {
          x: cx + Math.cos(localAngle) * radius,
          y: cy + Math.sin(localAngle) * radius,
        };
      });
  });

  return positions;
}

export function clampGraphPoint(point, bounds = { x: 1700, y: 1100 }) {
  return {
    x: Math.max(-bounds.x, Math.min(bounds.x, Number(point.x) || 0)),
    y: Math.max(-bounds.y, Math.min(bounds.y, Number(point.y) || 0)),
  };
}

function canonicalZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

export function fitGraphViewport(positions, slugs, width = 1200, height = 720, padding = 150) {
  const points = [...slugs].map((slug) => positions[slug]).filter(Boolean);
  if (!points.length) return { zoom: 1, panX: 0, panY: 0 };

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const graphWidth = Math.max(120, maxX - minX + padding * 2);
  const graphHeight = Math.max(120, maxY - minY + padding * 2);
  const zoom = Math.max(0.36, Math.min(2.2, Math.min(width / graphWidth, height / graphHeight)));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    zoom,
    panX: canonicalZero(-centerX * zoom),
    panY: canonicalZero(-centerY * zoom),
  };
}
