import type { EvolutionEdge, EvolutionNode } from "./evolution.mjs";
import type { ManuscriptClaimIssue } from "./manuscript-claims.mjs";

export type ManuscriptClaimProjection = {
  projectId: string;
  nodes: EvolutionNode[];
  edges: EvolutionEdge[];
  issues: ManuscriptClaimIssue[];
  stats: {
    manuscriptFiles: number;
    claims: number;
    claimIssues: number;
    duplicates: number;
    invalid: number;
    orphan: number;
  };
};

export function buildManuscriptClaimProjection(options?: {
  projectId?: string;
  mainFile?: string;
  files?: Array<{ file: string; content: string }>;
}): ManuscriptClaimProjection;

export function loadManuscriptClaimProjection(options?: {
  rootDir?: string;
  projectId?: string;
}): Promise<ManuscriptClaimProjection>;
