import type { EvolutionEdge, EvolutionNode, EvolutionTimelineEvent, ResearchEvolutionProjection } from "./evolution.mjs";

export type OptionalEvolutionLayer = {
  nodes?: EvolutionNode[];
  edges?: EvolutionEdge[];
  timeline?: EvolutionTimelineEvent[];
  [key: string]: unknown;
};

export function mergeEvolutionLayers(
  research: ResearchEvolutionProjection,
  ...layers: OptionalEvolutionLayer[]
): ResearchEvolutionProjection & { layers: OptionalEvolutionLayer[] };
