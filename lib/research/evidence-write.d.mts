export type EvidenceRelationship = { type: string; target: string };

export type ConsensusEvidencePaper = {
  id?: string;
  title: string;
  authors?: string[];
  year?: number;
  journal?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  takeaway?: string;
  studyType?: string;
  citationCount?: number;
  fullTextChunks?: Array<{ text: string; section?: string }>;
};

export type CreatedEvidence = {
  id: string;
  slug: string;
  filename: string;
  order: number;
  research: string;
  sourceKind: "pdf" | "consensus";
};

export function createEvidenceNote(options: {
  rootDir?: string;
  paperPath: string;
  page: number;
  quote: string;
  comment?: string;
  relationship?: EvidenceRelationship;
}): Promise<CreatedEvidence>;

export function createConsensusEvidenceNote(options: {
  rootDir?: string;
  paper?: unknown;
  query?: string;
  research?: string;
  comment?: string;
  relationship?: EvidenceRelationship;
}): Promise<CreatedEvidence>;
