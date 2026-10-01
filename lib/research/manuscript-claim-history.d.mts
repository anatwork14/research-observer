import type { ManuscriptRevisionHistory } from "./manuscript-history.mjs";

export type ManuscriptClaimHistoryClaim = {
  claimId: string;
  file: string;
  markerLine: number;
  line: number;
  section: string;
  excerpt: string;
};

export type ManuscriptClaimHistoryLink = {
  claimId: string;
  relation: "supports" | "contradicts" | "contextualizes" | "qualifies";
  evidenceSlug: string;
  evidenceTitle: string;
  currentCanonical: boolean;
  file: string;
  line: number;
};

export type ManuscriptClaimHistorySnapshot = {
  commit: string;
  shortCommit: string;
  at: string;
  author: string;
  subject: string;
  files: string[];
  stateChanged: boolean;
  mainFile: string;
  claims: ManuscriptClaimHistoryClaim[];
  links: ManuscriptClaimHistoryLink[];
  issues: Array<Record<string, unknown>>;
  stats: { claims: number; links: number; evidenceTargets: number; issues: number };
};

export type ManuscriptClaimHistoryEvent = {
  type: "claim-added" | "claim-removed" | "claim-text-changed" | "claim-moved" | "evidence-target-added" | "evidence-target-removed" | "relation-added" | "relation-removed" | "relation-changed";
  claimId: string;
  evidenceSlug?: string;
  relation?: string;
  beforeRelation?: string;
  afterRelation?: string;
  before?: string;
  after?: string;
};

export type ManuscriptClaimHistoryTransition = {
  fromCommit: string;
  toCommit: string;
  at: string;
  subject: string;
  events: ManuscriptClaimHistoryEvent[];
  counts: Record<string, number>;
};

export type ManuscriptClaimEvolution = {
  projectId: string;
  snapshots: ManuscriptClaimHistorySnapshot[];
  transitions: ManuscriptClaimHistoryTransition[];
  stats: { revisions: number; transitions: number; events: number };
  dirtyFiles?: string[];
  available?: boolean;
};

export function compareManuscriptClaimSnapshots(
  previous: ManuscriptClaimHistorySnapshot,
  current: ManuscriptClaimHistorySnapshot,
): ManuscriptClaimHistoryTransition;

export function buildManuscriptClaimEvolution(options?: {
  projectId?: string;
  snapshots?: ManuscriptClaimHistorySnapshot[];
}): ManuscriptClaimEvolution;

export function loadManuscriptClaimEvolution(options?: {
  rootDir?: string;
  projectId?: string;
  researchEntries?: Array<{ slug: string; title?: string; research?: string; type?: string }>;
  maxSnapshots?: number;
  history?: ManuscriptRevisionHistory;
}): Promise<ManuscriptClaimEvolution>;
