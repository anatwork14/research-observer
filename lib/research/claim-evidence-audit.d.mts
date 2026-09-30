import type { ResearchWorkspace } from "./compiler.mjs";
import type { ManuscriptClaimProjection } from "./manuscript-claim-projection.mjs";

export type ClaimEvidenceAuditProjectState = {
  projectId: string;
  available: boolean;
  projection?: ManuscriptClaimProjection;
  reason?: string;
};

export type ClaimEvidenceAuditClaim = {
  projectId: string;
  projectLabel: string;
  nodeId: string;
  claimId: string;
  file?: string;
  line?: number;
  section?: string;
  excerpt?: string;
  href?: string;
  relationCount: number;
  evidenceCount: number;
  evidenceTargets: Array<{ slug: string; title: string }>;
  relationCounts: Record<"supports" | "contradicts" | "contextualizes" | "qualifies", number>;
  hasSupport: boolean;
  hasContradiction: boolean;
  hasContext: boolean;
  hasQualification: boolean;
  hasSupportAndContradiction: boolean;
};

export type ClaimEvidenceAuditEvidence = {
  projectId: string;
  projectLabel: string;
  slug: string;
  title: string;
  href: string;
  claimCount: number;
  relationCount: number;
  claimIds: string[];
  relationCounts: Record<"supports" | "contradicts" | "contextualizes" | "qualifies", number>;
};

export type ClaimEvidenceAudit = ReturnType<typeof buildClaimEvidenceAudit>;

export function buildClaimEvidenceAudit(options: {
  workspace: ResearchWorkspace;
  researchIds?: string[];
  projectStates?: ClaimEvidenceAuditProjectState[];
}): {
  researchIds: string[];
  availableProjects: number;
  unavailableProjects: Array<{ projectId: string; label: string; reason: string }>;
  totals: {
    claims: number;
    claimsWithEvidence: number;
    claimsWithoutEvidence: number;
    relations: number;
    linkedEvidence: number;
    canonicalEvidence: number;
    evidenceWithoutClaimLinks: number;
    claimsWithSupportAndContradiction: number;
    claimIssues: number;
    relationIssues: number;
  };
  coverage: Array<{ key: string; label: string; value: number }>;
  relationMix: Array<{ key: string; label: string; value: number }>;
  claimSignals: Array<{ key: string; label: string; value: number }>;
  evidenceReuse: Array<{ key: string; label: string; value: number; slug: string; projectId: string }>;
  projects: Array<{
    id: string;
    label: string;
    available: boolean;
    canonicalEvidence: number;
    claims: number | null;
    claimsWithEvidence: number | null;
    claimsWithoutEvidence: number | null;
    relations: number | null;
    linkedEvidence: number | null;
    relationIssues: number | null;
  }>;
  claims: ClaimEvidenceAuditClaim[];
  evidence: ClaimEvidenceAuditEvidence[];
  issues: Array<{
    projectId: string;
    projectLabel: string;
    category: "claim" | "claim-evidence";
    type: string;
    file?: string;
    line?: number;
    claimId?: string;
    relation?: string;
    evidenceSlug?: string;
    message?: string;
  }>;
};

export function loadClaimEvidenceAudit(options: {
  rootDir?: string;
  workspace: ResearchWorkspace;
  researchIds?: string[];
}): Promise<ClaimEvidenceAudit>;
