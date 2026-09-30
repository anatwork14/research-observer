import type { ClaimEvidenceAudit, ClaimEvidenceAuditClaim } from "./claim-evidence-audit.mjs";

export type ClaimEvidenceAuditFilters = {
  relation?: "supports" | "contradicts" | "contextualizes" | "qualifies" | "";
  coverage?: "none" | "one" | "multiple" | "linked" | "";
  file?: string;
  section?: string;
  query?: string;
};

export type NormalizedClaimEvidenceAuditFilters = Required<ClaimEvidenceAuditFilters>;

export const CLAIM_AUDIT_COVERAGE_FILTERS: readonly ["none", "one", "multiple", "linked"];

export function normalizeClaimEvidenceAuditFilters(filters?: ClaimEvidenceAuditFilters): NormalizedClaimEvidenceAuditFilters;

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
