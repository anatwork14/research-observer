import Link from "next/link";
import { DonutChart, HorizontalBarChart, InsightCard } from "./ResearchAnalyticsCharts";
import type { ClaimEvidenceAudit } from "@/lib/research/claim-evidence-audit.mjs";
import styles from "./ClaimEvidenceAudit.module.css";

const RELATION_TYPES = ["supports", "contradicts", "contextualizes", "qualifies"] as const;

function ratio(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function relationSummary(counts: Record<(typeof RELATION_TYPES)[number], number>) {
  return RELATION_TYPES.filter((type) => counts[type] > 0).map((type) => ({ type, count: counts[type] }));
}

function projectHref(projectId: string) {
  const params = new URLSearchParams({ research: projectId, view: "provenance" });
  return `/graph?${params.toString()}`;
}

export function ClaimEvidenceAuditView({ audit }: { audit: ClaimEvidenceAudit }) {
  const hasAudit = audit.availableProjects > 0;
  const linkedPercent = ratio(audit.totals.claimsWithEvidence, audit.totals.claims);
  const claimRows = audit.claims.slice(0, 80);
  const unlinkedEvidence = audit.evidence.filter((item) => item.claimCount === 0).slice(0, 40);
  const issueRows = audit.issues.slice(0, 40);

  return (
    <section className={styles.shell}>
      <div className={styles.intro}>
        <div>
          <span className="kicker">Explicit manuscript semantics</span>
          <h2>Claim ↔ Evidence audit</h2>
        </div>
        <p>
          These counts describe only relationships the researcher explicitly authored. They are not a quality score,
          and Observaire does not infer missing support, contradiction, context, or qualification from prose or citations.
        </p>
      </div>

      {hasAudit && (
        <section className="intelligence-kpis" aria-label="Claim and Evidence audit statistics">
          <article className="panel"><span>Explicit Claims</span><strong>{audit.totals.claims}</strong><small>valid saved Claim anchors</small></article>
          <article className="panel"><span>With authored Evidence</span><strong>{audit.totals.claimsWithEvidence}</strong><small>{linkedPercent}% of audited Claims</small></article>
          <article className="panel"><span>No authored Evidence link</span><strong>{audit.totals.claimsWithoutEvidence}</strong><small>not a judgment of scientific support</small></article>
          <article className="panel"><span>Authored semantic links</span><strong>{audit.totals.relations}</strong><small>four explicit relation types</small></article>
          <article className="panel"><span>Evidence linked to Claims</span><strong>{audit.totals.linkedEvidence}</strong><small>{audit.totals.evidenceWithoutClaimLinks} canonical Evidence not linked in audited projects</small></article>
          <article className="panel"><span>Audit issues</span><strong>{audit.totals.claimIssues + audit.totals.relationIssues}</strong><small>{audit.totals.relationIssues} relationship issues</small></article>
        </section>
      )}

      {hasAudit ? (
        <>
          <section className="insight-chart-grid analytics">
            <InsightCard
              eyebrow="Coverage"
              title="Distinct Evidence targets per Claim"
              description="Counts unique canonical Evidence targets, regardless of how many relationship types connect the same pair."
            >
              <DonutChart data={audit.coverage} ariaLabel="Distinct Evidence targets per explicit Claim" />
            </InsightCard>

            <InsightCard
              eyebrow="Semantics"
              title="Authored relationship mix"
              description="Every bar is an explicit manuscript directive; no prose or citation inference is included."
            >
              <HorizontalBarChart data={audit.relationMix} ariaLabel="Authored Claim to Evidence relationship types" />
            </InsightCard>

            <InsightCard
              eyebrow="Signals"
              title="Claims touched by each relationship pattern"
              description="Categories may overlap. The support + contradiction bar counts Claims that explicitly contain both authored relation types."
              className="wide"
            >
              <HorizontalBarChart data={audit.claimSignals} ariaLabel="Claims containing explicit authored relation patterns" />
            </InsightCard>

            <InsightCard
              eyebrow="Projects"
              title="Authored Evidence coverage by project"
              description="Linked and unlinked refer only to explicit Claim↔Evidence directives in visible saved manuscript sources."
              className="wide"
            >
              <div className={styles.projectCoverage}>
                {audit.projects.map((project) => {
                  if (!project.available) {
                    return (
                      <div className={styles.projectRow} key={project.id}>
                        <div><strong>{project.label}</strong><small>Claim scan unavailable</small></div>
                        <span className={styles.unavailable}>Unavailable</span>
                      </div>
                    );
                  }
                  const total = project.claims || 0;
                  const linked = project.claimsWithEvidence || 0;
                  const unlinked = project.claimsWithoutEvidence || 0;
                  return (
                    <div className={styles.projectRow} key={project.id}>
                      <div>
                        <strong>{project.label}</strong>
                        <small>{total} Claims · {project.relations} authored links · {project.canonicalEvidence} canonical Evidence</small>
                      </div>
                      <div className={styles.coverageBar} aria-label={`${project.label}: ${linked} Claims with authored Evidence and ${unlinked} without`}>
                        <i className={styles.linked} style={{ width: `${ratio(linked, total)}%` }} />
                        <i className={styles.unlinked} style={{ width: `${ratio(unlinked, total)}%` }} />
                      </div>
                      <span>{linked} linked · {unlinked} without link</span>
                    </div>
                  );
                })}
              </div>
            </InsightCard>

            <InsightCard
              eyebrow="Reuse"
              title="Evidence reach across Claims"
              description="Number of distinct explicit Claims each canonical Evidence object is related to."
              className="wide"
            >
              <HorizontalBarChart data={audit.evidenceReuse.slice(0, 12)} ariaLabel="Distinct Claims per linked Evidence object" />
            </InsightCard>
          </section>

          <section className={`${styles.auditPanel} panel`}>
            <header className={styles.panelHeader}>
              <div><span className="kicker">Claim audit</span><h2>Explicit Claim coverage</h2></div>
              <p>{audit.claims.length > claimRows.length ? `Showing ${claimRows.length} of ${audit.claims.length} Claims; unlinked Claims are surfaced first.` : `${audit.claims.length} valid Claims in the audited scope.`}</p>
            </header>
            <div className={styles.claimTable}>
              <div className={styles.tableHeader}><span>Claim</span><span>Evidence targets</span><span>Authored relations</span><span>Source</span></div>
              {claimRows.map((claim) => {
                const summary = relationSummary(claim.relationCounts);
                return (
                  <div className={styles.tableRow} key={claim.nodeId}>
                    <div>
                      {claim.href ? <Link href={claim.href}>{claim.claimId}</Link> : <strong>{claim.claimId}</strong>}
                      <small>{claim.projectLabel}{claim.section ? ` · ${claim.section}` : ""}</small>
                    </div>
                    <div className={styles.evidenceLinks}>
                      {claim.evidenceTargets.length ? claim.evidenceTargets.map((item) => (
                        <Link href={`/progress/${item.slug}`} key={item.slug}>{item.title}</Link>
                      )) : <em>0 authored Evidence targets</em>}
                    </div>
                    <div className={styles.relationTags}>
                      {summary.length ? summary.map((item) => (
                        <span data-relation={item.type} key={item.type}>{item.type}{item.count > 1 ? ` ×${item.count}` : ""}</span>
                      )) : <em>None</em>}
                    </div>
                    <div><span>{claim.file || "manuscript"}</span><small>{claim.line ? `line ${claim.line}` : "saved source"}</small></div>
                  </div>
                );
              })}
              {!claimRows.length && <p className={styles.empty}>No valid explicit manuscript Claims were found in the selected audited projects.</p>}
            </div>
          </section>

          <section className={styles.twoColumn}>
            <article className={`${styles.auditPanel} panel`}>
              <header className={styles.panelHeader}>
                <div><span className="kicker">Evidence inventory</span><h2>No authored Claim link</h2></div>
                <p>Canonical Evidence can be valid and useful even when it is not linked to a manuscript Claim. This is an audit list, not an error list.</p>
              </header>
              <div className={styles.compactList}>
                {unlinkedEvidence.map((item) => (
                  <Link href={item.href} key={`${item.projectId}:${item.slug}`}>
                    <span><strong>{item.title}</strong><small>{item.projectLabel} · {item.slug}</small></span>
                    <em>0 Claims</em>
                  </Link>
                ))}
                {!unlinkedEvidence.length && <p className={styles.empty}>Every canonical Evidence object in the available audited projects has at least one authored Claim link.</p>}
                {audit.totals.evidenceWithoutClaimLinks > unlinkedEvidence.length && <small className={styles.more}>Showing {unlinkedEvidence.length} of {audit.totals.evidenceWithoutClaimLinks} unlinked Evidence objects.</small>}
              </div>
            </article>

            <article className={`${styles.auditPanel} panel`}>
              <header className={styles.panelHeader}>
                <div><span className="kicker">Integrity</span><h2>Claim and relationship issues</h2></div>
                <p>Malformed, duplicate, unresolved, cross-project, and wrong-type directives remain visible but are excluded from valid coverage counts.</p>
              </header>
              <div className={styles.compactList}>
                {issueRows.map((issue, index) => (
                  <div className={styles.issue} key={`${issue.projectId}:${issue.file || "?"}:${issue.line || 0}:${issue.type}:${index}`}>
                    <span><strong>{issue.type}</strong><small>{issue.projectLabel} · {issue.file || "manuscript"}{issue.line ? `:${issue.line}` : ""}</small></span>
                    <em>{[issue.claimId, issue.relation, issue.evidenceSlug].filter(Boolean).join(" · ") || issue.category}</em>
                  </div>
                ))}
                {!issueRows.length && <p className={styles.empty}>No Claim or Claim↔Evidence projection issues in the available audited projects.</p>}
                {audit.issues.length > issueRows.length && <small className={styles.more}>Showing {issueRows.length} of {audit.issues.length} issues.</small>}
              </div>
            </article>
          </section>
        </>
      ) : (
        <section className={`${styles.auditPanel} panel`}>
          <header className={styles.panelHeader}>
            <div><span className="kicker">Claims unavailable</span><h2>No visible editable manuscript source was available to audit</h2></div>
            <p>The canonical research analytics remain available; Claim coverage is not reported as zero when its manuscript source could not be scanned.</p>
          </header>
        </section>
      )}

      {audit.unavailableProjects.length > 0 && (
        <section className={`${styles.auditPanel} panel`}>
          <header className={styles.panelHeader}>
            <div><span className="kicker">Partial scope</span><h2>Projects not included in Claim coverage counts</h2></div>
          </header>
          <div className={styles.compactList}>
            {audit.unavailableProjects.map((project) => (
              <Link href={projectHref(project.projectId)} key={project.projectId}>
                <span><strong>{project.label}</strong><small>{project.reason}</small></span>
                <em>Open Provenance</em>
              </Link>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
