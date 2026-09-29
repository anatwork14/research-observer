import type { ManuscriptRevisionHistory } from "./manuscript-history.mjs";
import type { EvolutionEdge, EvolutionNode, EvolutionTimelineEvent } from "./evolution.mjs";

export type ManuscriptRevisionProjection = {
  projectId: string;
  nodes: EvolutionNode[];
  edges: EvolutionEdge[];
  timeline: EvolutionTimelineEvent[];
  dirtyFiles: string[];
  available: boolean;
  stats: { revisions: number; dirtyFiles: number };
};

export function buildManuscriptRevisionProjection(options?: {
  projectId?: string;
  history?: ManuscriptRevisionHistory;
}): ManuscriptRevisionProjection;
