export type GraphLayoutNode = { slug: string; order: number; research?: string };
export type GraphLayoutEdge = { source: string; target: string; explicit: boolean };
export type GraphPoint = { x: number; y: number };

export function graphDegreeMap(nodes: GraphLayoutNode[], edges: GraphLayoutEdge[]): Map<string, number>;
export function graphNeighborhood(
  edges: GraphLayoutEdge[],
  root: string,
  depth?: number,
  options?: { explicitOnly?: boolean },
): Set<string>;
export function initialGraphPositions(nodes: GraphLayoutNode[]): Record<string, GraphPoint>;
export function clampGraphPoint(point: GraphPoint, bounds?: { x: number; y: number }): GraphPoint;
export function fitGraphViewport(
  positions: Record<string, GraphPoint>,
  slugs: Iterable<string>,
  width?: number,
  height?: number,
  padding?: number,
): { zoom: number; panX: number; panY: number };
