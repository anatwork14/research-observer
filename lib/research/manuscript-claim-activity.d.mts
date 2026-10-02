import type {
  ManuscriptClaimHistoryEvent,
  ManuscriptClaimHistoryTransition,
} from "./manuscript-claim-history.mjs";

export const MANUSCRIPT_CLAIM_HISTORY_EVENT_TYPES: readonly ManuscriptClaimHistoryEvent["type"][];
export const MANUSCRIPT_CLAIM_HISTORY_RELATIONS: readonly ("supports" | "contradicts" | "contextualizes" | "qualifies")[];

export function isManuscriptClaimHistoryEventType(value: unknown): value is ManuscriptClaimHistoryEvent["type"];
export function isManuscriptClaimHistoryRelation(value: unknown): value is "supports" | "contradicts" | "contextualizes" | "qualifies";

export function filterManuscriptClaimHistoryEvents(
  events?: ManuscriptClaimHistoryEvent[],
  filters?: {
    claimId?: string;
    evidenceSlug?: string;
    eventType?: string;
    relationType?: string;
  },
): ManuscriptClaimHistoryEvent[];

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
  options?: {
    limit?: number;
    claimId?: string;
    evidenceSlug?: string;
    eventType?: string;
    relationType?: string;
  },
): ManuscriptClaimActivity;
