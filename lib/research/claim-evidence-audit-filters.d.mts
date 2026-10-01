import type { ClaimEvidenceAudit, ClaimEvidenceAuditClaim } from "./claim-evidence-audit.mjs";

export type ClaimEvidenceAuditFilters = {
  relation?: string;
  coverage?: string;
  signal?: string;
  evidence?: string;
  file?: string;
  section?: string;
  query?: string;
};

export type NormalizedClaimEvidenceAuditFilters = {
  relation: "supports" | "contradicts" | "contextualizes" | "qualifies" | "";
  coverage: "none" | "one" | "multiple" | "linked" | "";
  signal: "support-contradiction" | "";
  evidence: string;
  file: string;
  section: string;
  query: string;
};

export const CLAIM_AUDIT_COVERAGE_FILTERS: readonly ["none", "one", "multiple", "linked"];
export const CLAIM_AUDIT_SIGNAL_FILTERS: readonly ["support-contradiction"];

export function normalizeClaimEvidenceAuditFilters(filters?: ClaimEvidenceAuditFilters): NormalizedClaimEvidenceAuditFilters;

export function claimAuditFilterHref(
  researchScope: string[],
  filters: NormalizedClaimEvidenceAuditFilters,
  patch?: Partial<NormalizedClaimEvidenceAuditFilters>,
): string;

export function claimEvidenceAuditFilterOptions(audit: ClaimEvidenceAudit): {
  files: Array<{ value: string; count: number }>;
  sections: Array<{ value: string; count: number }>;
};

export function filterClaimEvidenceAudit(audit: ClaimEvidenceAudit, filters?: ClaimEvidenceAuditFilters): {
  filters: NormalizedClaimEvidenceAuditFilters;
  claims: ClaimEvidenceAuditClaim[];
  matchedClaims: number;
  totalClaims: number;
  activeFilters: number;
  options: ReturnType<typeof claimEvidenceAuditFilterOptions>;
};
