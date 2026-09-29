import type { ResearchEvolutionProjection } from "./evolution.mjs";

export type OptionalEvolutionLayer = {
  nodes?: any[];
  edges?: any[];
  timeline?: any[];
  [key: string]: unknown;
};

export function mergeEvolutionLayers(
  research: ResearchEvolutionProjection,
  ...layers: OptionalEvolutionLayer[]
): ResearchEvolutionProjection & { layers: OptionalEvolutionLayer[] };
