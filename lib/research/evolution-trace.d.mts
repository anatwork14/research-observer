import type { EvolutionEdge } from "./evolution.mjs";

export function traceEvolutionNeighborhood(
  edges?: EvolutionEdge[],
  start?: string,
  maxDepth?: number,
): Set<string>;
