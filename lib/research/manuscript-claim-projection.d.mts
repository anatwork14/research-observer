import type { EvolutionEdge, EvolutionNode } from "./evolution.mjs";
import type { ManuscriptClaimIssue } from "./manuscript-claims.mjs";
import type { ManuscriptClaimEvidenceParseIssue, ManuscriptClaimEvidenceRelationType } from "./manuscript-claim-relations.mjs";

export type ManuscriptClaimRelationIssue = (ManuscriptClaimEvidenceParseIssue & { file?: string }) | {
  type: "duplicate-relation" | "claim-unresolved" | "evidence-missing" | "evidence-cross-project" | "evidence-type";
  file?: string;
  line?: number;
  claimId?: string;
  relation?: string;
  evidenceSlug?: string;
  message: string;
};

export type ManuscriptClaimProjection = {
  projectId: string;
  nodes: EvolutionNode[];
  edges: EvolutionEdge[];
  issues: ManuscriptClaimIssue[];
  relationIssues: ManuscriptClaimRelationIssue[];
  stats: {
    manuscriptFiles: number;
    claims: number;
    claimIssues: number;
    duplicates: number;
    invalid: number;
    orphan: number;
    relations: number;
    relationIssues: number;
    relationDuplicates: number;
    relationUnresolved: number;
  };
};

export type ClaimEvidenceResearchEntry = {
  slug: string;
  research: string;
  type?: string;
  title?: string;
};

export function buildManuscriptClaimProjection(options?: {
  projectId?: string;
  mainFile?: string;
  files?: Array<{ file: string; content: string }>;
  researchEntries?: ClaimEvidenceResearchEntry[];
}): ManuscriptClaimProjection;

export function loadManuscriptClaimProjection(options?: {
  rootDir?: string;
  projectId?: string;
  researchEntries?: ClaimEvidenceResearchEntry[];
}): Promise<ManuscriptClaimProjection>;

export type { ManuscriptClaimEvidenceRelationType };
