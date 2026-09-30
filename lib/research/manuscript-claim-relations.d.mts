export type ManuscriptClaimEvidenceRelationType = "supports" | "contradicts" | "contextualizes" | "qualifies";

export type ManuscriptClaimEvidenceRelation = {
  claimId: string;
  relation: ManuscriptClaimEvidenceRelationType;
  evidenceSlug: string;
  line: number;
};

export type ManuscriptClaimEvidenceParseIssue = {
  type: "invalid-directive" | "invalid-claim-id" | "unsupported-relation" | "invalid-evidence-slug";
  line: number;
  claimId?: string;
  relation?: string;
  evidenceSlug?: string;
  message: string;
};

export const MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS: readonly ManuscriptClaimEvidenceRelationType[];

export function parseManuscriptClaimEvidenceRelations(content: string): {
  relations: ManuscriptClaimEvidenceRelation[];
  issues: ManuscriptClaimEvidenceParseIssue[];
};

export function manuscriptClaimEvidenceEdgeId(
  projectId: string,
  claimId: string,
  relation: ManuscriptClaimEvidenceRelationType,
  evidenceSlug: string,
): string;
