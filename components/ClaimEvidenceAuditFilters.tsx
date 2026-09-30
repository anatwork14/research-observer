"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  claimAuditFilterHref,
  type NormalizedClaimEvidenceAuditFilters,
} from "@/lib/research/claim-evidence-audit-filters.mjs";
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

function preserveSelectedOption(
  options: Array<{ value: string; count: number }>,
  selected: string,
) {
  if (!selected || options.some((item) => item.value === selected)) return options;
  return [{ value: selected, count: 0 }, ...options];
}

function syncFilterControls(form: HTMLFormElement | null, search: string) {
  if (!form) return;
  const params = new URLSearchParams(search);
  for (const name of ["claimRelation", "claimCoverage", "claimFile", "claimSection", "claimQ"]) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
      field.value = params.get(name) ?? "";
    }
  }
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
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const syncFromUrl = () => syncFilterControls(formRef.current, window.location.search);
    const scheduleSync = () => {
      window.requestAnimationFrame(syncFromUrl);
      window.setTimeout(syncFromUrl, 0);
    };
    window.addEventListener("pageshow", scheduleSync);
    window.addEventListener("popstate", scheduleSync);
    syncFromUrl();
    return () => {
      window.removeEventListener("pageshow", scheduleSync);
      window.removeEventListener("popstate", scheduleSync);
    };
  }, []);
  useEffect(() => {
    syncFilterControls(formRef.current, window.location.search);
  }, [filters.relation, filters.coverage, filters.file, filters.section, filters.query]);

  const clearFilters: NormalizedClaimEvidenceAuditFilters = {
    relation: "",
    coverage: "",
    file: "",
    section: "",
    query: "",
  };
  const fileOptions = preserveSelectedOption(options.files, filters.file);
  const sectionOptions = preserveSelectedOption(options.sections, filters.section);
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

      <form ref={formRef} className={styles.filterForm} action="/insights" method="get">
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
            {fileOptions.map((item) => (
              <option value={item.value} key={item.value}>
                {item.value} ({item.count}{item.count === 0 && item.value === filters.file ? " in current scope" : ""})
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Section</span>
          <select name="claimSection" defaultValue={filters.section}>
            <option value="">Any section</option>
            {sectionOptions.map((item) => (
              <option value={item.value} key={item.value}>
                {item.value} ({item.count}{item.count === 0 && item.value === filters.section ? " in current scope" : ""})
              </option>
            ))}
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
