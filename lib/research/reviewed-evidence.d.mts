export type ReviewedEvidenceRelationship = { type: "supports" | "contradicts" | "answers"; target: string } | null;

export type ReviewedEvidencePreview = {
  workspaceSignature: string;
  proposalHash: string;
  sourceIdentity: string;
  source: {
    title: string;
    doi?: string;
    paperId?: string;
    url?: string;
    hasFullTextExcerpt: boolean;
  };
  project: { id: string; label: string; directory: string };
  target: { slug: string; title: string; type?: string; research: string } | null;
  relationship: ReviewedEvidenceRelationship;
  file: { id: string; filename: string; content: string };
};

export function reviewedEvidenceWritable(): boolean;

export function previewReviewedConsensusEvidence(input?: {
  rootDir?: string;
  paper?: unknown;
  query?: string;
  research?: string;
  targetSlug?: string;
  relationType?: string;
  comment?: string;
}): Promise<ReviewedEvidencePreview>;

export function applyReviewedConsensusEvidence(input?: {
  rootDir?: string;
  paper?: unknown;
  query?: string;
  research?: string;
  targetSlug?: string;
  relationType?: string;
  comment?: string;
  expectedWorkspaceSignature?: string;
  expectedProposalHash?: string;
}): Promise<{
  slug: string;
  filename: string;
  title: string;
  research: string;
  relationship: ReviewedEvidenceRelationship;
  sourceIdentity: string;
  workspaceSignature: string;
}>;
