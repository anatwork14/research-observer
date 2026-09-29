import type { EvolutionEdge, EvolutionLineage, EvolutionNode } from "./evolution.mjs";

export function orderVersionLineages(
  lineages?: EvolutionLineage[],
  edges?: EvolutionEdge[],
  nodes?: EvolutionNode[],
): EvolutionLineage[];
