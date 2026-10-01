import { MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS } from "./manuscript-claim-relations.mjs";

export const CLAIM_AUDIT_COVERAGE_FILTERS = ["none", "one", "multiple", "linked"];
export const CLAIM_AUDIT_SIGNAL_FILTERS = ["support", "contradiction", "support-contradiction", "context", "qualification"];

function clean(value, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

export function normalizeClaimEvidenceAuditFilters(filters = {}) {
  const relation = clean(filters.relation, 32);
  const coverage = clean(filters.coverage, 32);
  const signal = clean(filters.signal, 48);
  return {
    relation: MANUSCRIPT_CLAIM_EVIDENCE_RELATIONS.includes(relation) ? relation : "",
    coverage: CLAIM_AUDIT_COVERAGE_FILTERS.includes(coverage) ? coverage : "",
    signal: CLAIM_AUDIT_SIGNAL_FILTERS.includes(signal) ? signal : "",
    evidence: clean(filters.evidence, 240),
    file: clean(filters.file, 240),
    section: clean(filters.section, 240),
    query: clean(filters.query, 180),
  };
}

export function claimAuditFilterHref(researchScope, filters, patch = {}) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams({ view: "claims" });
  if (researchScope.length) params.set("research", researchScope.join(","));
  if (next.relation) params.set("claimRelation", next.relation);
  if (next.coverage) params.set("claimCoverage", next.coverage);
  if (next.signal) params.set("claimSignal", next.signal);
  if (next.evidence) params.set("claimEvidence", next.evidence);
  if (next.file) params.set("claimFile", next.file);
  if (next.section) params.set("claimSection", next.section);
  if (next.query) params.set("claimQ", next.query);
  return `/insights?${params.toString()}`;
}

function matchesCoverage(claim, coverage) {
  if (!coverage) return true;
  if (coverage === "none") return claim.evidenceCount === 0;
  if (coverage === "one") return claim.evidenceCount === 1;
  if (coverage === "multiple") return claim.evidenceCount >= 2;
  if (coverage === "linked") return claim.evidenceCount > 0;
  return true;
}

function matchesSignal(claim, signal) {
  if (!signal) return true;
  if (signal === "support") return claim.hasSupport;
  if (signal === "contradiction") return claim.hasContradiction;
  if (signal === "support-contradiction") return claim.hasSupportAndContradiction;
  if (signal === "context") return claim.hasContext;
  if (signal === "qualification") return claim.hasQualification;
  return true;
}

function textHaystack(claim) {
  return [
    claim.claimId,
    claim.projectLabel,
    claim.file,
    claim.section,
    claim.excerpt,
    ...(claim.evidenceTargets || []).flatMap((item) => [item.slug, item.title]),
  ].filter(Boolean).join("\n").toLocaleLowerCase("en");
}

export function claimEvidenceAuditFilterOptions(audit) {
  const files = new Map();
  const sections = new Map();
  for (const claim of audit.claims || []) {
    if (claim.file) files.set(claim.file, (files.get(claim.file) || 0) + 1);
    if (claim.section) sections.set(claim.section, (sections.get(claim.section) || 0) + 1);
  }
  const sortEntries = (map) => [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, count }));
  return {
    files: sortEntries(files),
    sections: sortEntries(sections),
  };
}

export function filterClaimEvidenceAudit(audit, rawFilters = {}) {
  const filters = normalizeClaimEvidenceAuditFilters(rawFilters);
  const query = filters.query.toLocaleLowerCase("en");
  const claims = (audit.claims || []).filter((claim) => {
    if (filters.relation && Number(claim.relationCounts?.[filters.relation] || 0) < 1) return false;
    if (!matchesCoverage(claim, filters.coverage)) return false;
    if (!matchesSignal(claim, filters.signal)) return false;
    if (filters.evidence && !(claim.evidenceTargets || []).some((item) => item.slug === filters.evidence)) return false;
    if (filters.file && claim.file !== filters.file) return false;
    if (filters.section && claim.section !== filters.section) return false;
    if (query && !textHaystack(claim).includes(query)) return false;
    return true;
  });
  return {
    filters,
    claims,
    matchedClaims: claims.length,
    totalClaims: (audit.claims || []).length,
    activeFilters: Object.values(filters).filter(Boolean).length,
    options: claimEvidenceAuditFilterOptions(audit),
  };
}
