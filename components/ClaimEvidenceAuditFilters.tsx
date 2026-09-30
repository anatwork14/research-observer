import Link from "next/link";
import type { NormalizedClaimEvidenceAuditFilters } from "@/lib/research/claim-evidence-audit-filters.mjs";
import styles from "./ClaimEvidenceAudit.module.css";

const RELATIONS = ["supports", "contradicts", "contextualizes", "qualifies"] as const;
const COVERAGE = [
  ["none", "0 Evidence targets"],
  ["one", "1 Evidence target"],
  ["multiple", "2+ Evidence targets"],
  ["linked", "Any authored Evidence link"],
] as const;

type Options = {
  files: Array<{ value: string; count: number }>;
  sections: Array<{ value: string; count: number }>;
};

export function claimAuditFilterHref(
  researchScope: string[],
  filters: NormalizedClaimEvidenceAuditFilters,
  patch: Partial<NormalizedClaimEvidenceAuditFilters> = {},
) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams({ view: "claims" });
  if (researchScope.length) params.set("research", researchScope.join(","));
  if (next.relation) params.set("claimRelation", next.relation);
  if (next.coverage) params.set("claimCoverage", next.coverage);
  if (next.file) params.set("claimFile", next.file);
  if (next.section) params.set("claimSection", next.section);
  if (next.query) params.set("claimQ", next.query);
  return `/insights?${params.toString()}`;
}

export function ClaimEvidenceAuditFilters({
  filters,
  options,
  researchScope,
  matchedClaims,
  totalClaims,
  activeFilters,
}: {
  filters: NormalizedClaimEvidenceAuditFilters;
  options: Options;
  researchScope: string[];
  matchedClaims: number;
  totalClaims: number;
  activeFilters: number;
}) {
  const clearFilters: NormalizedClaimEvidenceAuditFilters = {
    relation: "",
    coverage: "",
    file: "",
    section: "",
    query: "",
  };
  const active = [
    filters.relation && { key: "relation", label: `Relation: ${filters.relation}`, patch: { relation: "" } },
    filters.coverage && { key: "coverage", label: `Coverage: ${COVERAGE.find(([value]) => value === filters.coverage)?.[1] || filters.coverage}`, patch: { coverage: "" } },
    filters.file && { key: "file", label: `File: ${filters.file}`, patch: { file: "" } },
    filters.section && { key: "section", label: `Section: ${filters.section}`, patch: { section: "" } },
    filters.query && { key: "query", label: `Search: ${filters.query}`, patch: { query: "" } },
  ].filter(Boolean) as Array<{ key: string; label: string; patch: Partial<NormalizedClaimEvidenceAuditFilters> }>;

  return (
    <section className={`${styles.filterPanel} panel`} aria-label="Claim audit drill-down filters">
      <div className={styles.filterHeading}>
        <div>
          <span className="kicker">Drill-down</span>
          <h2>Filter explicit Claims</h2>
        </div>
        <p>
          {activeFilters ? `${matchedClaims} of ${totalClaims} Claims match ${activeFilters} active filter${activeFilters === 1 ? "" : "s"}.` : `${totalClaims} Claims in the complete audited scope.`}
          {" "}Charts above remain complete-scope context; these controls narrow the Claim audit table only.
        </p>
      </div>

      <form className={styles.filterForm} action="/insights" method="get">
        <input type="hidden" name="view" value="claims" />
        {researchScope.length > 0 && <input type="hidden" name="research" value={researchScope.join(",")} />}

        <label>
          <span>Relation</span>
          <select name="claimRelation" defaultValue={filters.relation}>
            <option value="">Any authored relation</option>
            {RELATIONS.map((relation) => <option value={relation} key={relation}>{relation}</option>)}
          </select>
        </label>

        <label>
          <span>Coverage</span>
          <select name="claimCoverage" defaultValue={filters.coverage}>
            <option value="">Any Evidence-target count</option>
            {COVERAGE.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>

        <label>
          <span>File</span>
          <select name="claimFile" defaultValue={filters.file}>
            <option value="">Any manuscript file</option>
            {options.files.map((item) => <option value={item.value} key={item.value}>{item.value} ({item.count})</option>)}
          </select>
        </label>

        <label>
          <span>Section</span>
          <select name="claimSection" defaultValue={filters.section}>
            <option value="">Any section</option>
            {options.sections.map((item) => <option value={item.value} key={item.value}>{item.value} ({item.count})</option>)}
          </select>
        </label>

        <label className={styles.searchField}>
          <span>Search</span>
          <input name="claimQ" type="search" defaultValue={filters.query} placeholder="Claim ID, Evidence, section, file…" />
        </label>

        <div className={styles.filterActions}>
          <button type="submit">Apply filters</button>
          {activeFilters > 0 && <Link href={claimAuditFilterHref(researchScope, filters, clearFilters)}>Clear all</Link>}
        </div>
      </form>

      {active.length > 0 && (
        <div className={styles.activeFilters} aria-label="Active Claim audit filters">
          {active.map((item) => (
            <Link href={claimAuditFilterHref(researchScope, filters, item.patch)} key={item.key} title={`Remove ${item.label}`}>
              {item.label}<span aria-hidden="true">×</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
