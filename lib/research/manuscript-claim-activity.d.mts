import type { ManuscriptClaimEvidenceRelationType } from "./manuscript-claim-relations.mjs";
import type {
  ManuscriptClaimHistoryEvent,
  ManuscriptClaimHistoryTransition,
} from "./manuscript-claim-history.mjs";

export const MANUSCRIPT_CLAIM_HISTORY_EVENT_TYPES: readonly ManuscriptClaimHistoryEvent["type"][];
export const MANUSCRIPT_CLAIM_HISTORY_EVENT_LABELS: Readonly<Record<ManuscriptClaimHistoryEvent["type"], string>>;
export const MANUSCRIPT_CLAIM_HISTORY_RELATIONS: readonly ManuscriptClaimEvidenceRelationType[];

export function isManuscriptClaimHistoryEventType(value: unknown): value is ManuscriptClaimHistoryEvent["type"];
export function isManuscriptClaimHistoryRelation(value: unknown): value is ManuscriptClaimEvidenceRelationType;

export type ManuscriptClaimActivityFilters = {
  claimId?: string;
  evidenceSlug?: string;
  eventType?: string;
  relationType?: string;
};

export function filterManuscriptClaimHistoryEvents(
  events?: ManuscriptClaimHistoryEvent[],
  filters?: ManuscriptClaimActivityFilters,
): ManuscriptClaimHistoryEvent[];

export type ManuscriptClaimEventComposition = {
  rows: Array<{
    type: ManuscriptClaimHistoryEvent["type"];
    label: string;
    count: number;
  }>;
  categories: {
    claimState: number;
    evidenceTargets: number;
    relations: number;
  };
  stats: {
    events: number;
    eventTypes: number;
    maxCount: number;
  };
};

export function buildManuscriptClaimEventComposition(
  events?: ManuscriptClaimHistoryEvent[],
  filters?: ManuscriptClaimActivityFilters,
): ManuscriptClaimEventComposition;

export type ManuscriptClaimActivityRow = {
  fromCommit: string;
  toCommit: string;
  at: string;
  subject: string;
  events: number;
  claimState: number;
  evidenceTargets: number;
  relations: number;
  claimIds: string[];
};

export type ManuscriptClaimActivity = {
  rows: ManuscriptClaimActivityRow[];
  stats: {
    transitions: number;
    events: number;
    claims: number;
    maxEvents: number;
  };
};

export function buildManuscriptClaimActivity(
  transitions?: ManuscriptClaimHistoryTransition[],
  options?: ManuscriptClaimActivityFilters & { limit?: number },
): ManuscriptClaimActivity;

export type ManuscriptClaimActivityMatrixCell = {
  fromCommit: string;
  toCommit: string;
  events: number;
  claimState: number;
  evidenceTargets: number;
  relations: number;
};

export type ManuscriptClaimActivityMatrix = {
  columns: Array<{
    fromCommit: string;
    toCommit: string;
    at: string;
    subject: string;
  }>;
  rows: Array<{
    claimId: string;
    totalEvents: number;
    cells: ManuscriptClaimActivityMatrixCell[];
  }>;
  stats: {
    transitions: number;
    claims: number;
    totalClaims: number;
    changedCells: number;
    maxCellEvents: number;
    truncatedClaims: number;
  };
};

export function buildManuscriptClaimActivityMatrix(
  transitions?: ManuscriptClaimHistoryTransition[],
  options?: ManuscriptClaimActivityFilters & {
    transitionLimit?: number;
    claimLimit?: number;
  },
): ManuscriptClaimActivityMatrix;

export type ManuscriptEventTypeActivityMatrixCell = {
  fromCommit: string;
  toCommit: string;
  events: number;
};

export type ManuscriptEventTypeActivityMatrix = {
  columns: Array<{
    fromCommit: string;
    toCommit: string;
    at: string;
    subject: string;
  }>;
  rows: Array<{
    type: ManuscriptClaimHistoryEvent["type"];
    label: string;
    totalEvents: number;
    cells: ManuscriptEventTypeActivityMatrixCell[];
  }>;
  stats: {
    transitions: number;
    eventTypes: number;
    events: number;
    changedCells: number;
    maxCellEvents: number;
  };
};

export function buildManuscriptEventTypeActivityMatrix(
  transitions?: ManuscriptClaimHistoryTransition[],
  options?: ManuscriptClaimActivityFilters & { transitionLimit?: number },
): ManuscriptEventTypeActivityMatrix;
