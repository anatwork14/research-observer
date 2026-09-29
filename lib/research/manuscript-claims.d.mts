import type { ManuscriptPassage } from "./manuscript-passages.mjs";

export type ManuscriptClaimAnchor = {
  claimId: string;
  markerLine: number;
  targetLine: number;
  passage: ManuscriptPassage;
};

export type ManuscriptClaimIssue = {
  type: "invalid-id" | "orphan" | "duplicate";
  line?: number;
  claimId?: string;
  file?: string;
  message: string;
};

export function isValidManuscriptClaimId(value: unknown): boolean;
export function manuscriptClaimNodeId(projectId: string, claimId: string): string;
export function parseManuscriptClaimAnchors(content: string): {
  claims: ManuscriptClaimAnchor[];
  issues: ManuscriptClaimIssue[];
};
export function claimPassageIdentity(projectId: string, file: string, claim: ManuscriptClaimAnchor): string;
