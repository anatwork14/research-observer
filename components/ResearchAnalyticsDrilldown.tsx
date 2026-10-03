import Link from "next/link";
import type { AnalyticsDrilldown } from "@/lib/research/analytics-drilldown.mjs";
import styles from "./ResearchAnalyticsDrilldown.module.css";

type LinkItem = { key: string; label: string; value: number; href: string };

export function AnalyticsDrilldownRail({
  label = "Inspect",
  items,
}: {
  label?: string;
  items: LinkItem[];
}) {
  const visible = items.filter((item) => item.value > 0);
  if (!visible.length) return null;
  return (
    <nav className={styles.rail} aria-label={`${label} chart values`}>
      <span>{label}</span>
      <div>
        {visible.map((item) => (
          <Link key={item.key} href={item.href}>
            {item.label}<strong>{item.value}</strong>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function EvidenceSignalOverview({
  summary,
  hrefFor,
}: {
  summary: {
    evidence: number;
    signals: number;
    supports: number;
    contradicts: number;
    answers: number;
    targetsWithSignals: number;
    targetsWithoutSignals: number;
  };
  hrefFor: (value: string) => string;
}) {
  const items = [
    ["supports", "Supports", summary.supports],
    ["contradicts", "Contradicts", summary.contradicts],
    ["answers", "Answers", summary.answers],
    ["with", "Targets with signal", summary.targetsWithSignals],
    ["without", "No explicit signal", summary.targetsWithoutSignals],
  ] as const;
  return (
    <div className={styles.signalOverview}>
      <div className={styles.signalSummary}>
        <span><strong>{summary.evidence}</strong> Evidence objects</span>
        <span><strong>{summary.signals}</strong> explicit evidence signals</span>
      </div>
      <AnalyticsDrilldownRail
        label="Inspect evidence"
        items={items.map(([key, label, value]) => ({ key, label, value, href: hrefFor(key) }))}
      />
      <p>Counts come only from explicit <code>supports</code>, <code>contradicts</code>, and <code>answers</code> edges authored from Evidence objects. “No explicit signal” means no such edge is present; it is not a quality judgment.</p>
    </div>
  );
}

function entryMeta(entry: AnalyticsDrilldown["entries"][number]) {
  return [entry.research ?? "default", entry.type, entry.status, entry.date].filter(Boolean).join(" · ");
}

export function ResearchAnalyticsDrilldown({
  drilldown,
  clearHref,
}: {
  drilldown: AnalyticsDrilldown;
  clearHref: string;
}) {
  return (
    <section id="analytics-drilldown" className={`${styles.panel} panel`} aria-live="polite">
      <header className={styles.header}>
        <div>
          <span className="kicker">Chart drill-down</span>
          <h2>{drilldown.title}</h2>
          <p>{drilldown.description}</p>
        </div>
        <div className={styles.headerActions}>
          <strong>{drilldown.count}</strong>
          <Link href={clearHref}>Clear</Link>
        </div>
      </header>

      {drilldown.kind === "relations" && (
        <div className={styles.relations}>
          {drilldown.relations.length === 0 && <p className={styles.empty}>No explicit relationships match this chart cell.</p>}
          {drilldown.relations.map((row, index) => (
            <article className={styles.relation} key={`${row.source.slug}-${row.relation.type}-${row.relation.target}-${index}`}>
              <Link href={`/progress/${row.source.slug}`}><strong>{row.source.title}</strong></Link>
              <span className={styles.arrow}>→</span>
              <div>
                <span className={styles.relationType}>{row.relation.type}</span>
                {row.target ? <Link href={`/progress/${row.target.slug}`}><strong>{row.target.title}</strong></Link> : <strong>{row.relation.target}</strong>}
                {row.relation.note && <small>{row.relation.note}</small>}
              </div>
            </article>
          ))}
        </div>
      )}

      {drilldown.kind === "entries" && (
        <div className={styles.entries}>
          {drilldown.entries.length === 0 && <p className={styles.empty}>No research objects match this chart selection.</p>}
          {drilldown.entries.map((entry) => (
            <Link href={`/progress/${entry.slug}`} className={styles.entry} key={entry.slug}>
              <span>{entryMeta(entry)}</span>
              <strong>{entry.title}</strong>
              <p>{entry.summary || "Open the research object to inspect its authored content and relationships."}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
