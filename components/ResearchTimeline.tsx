import Link from "next/link";
import type { ResearchEntry } from "@/lib/research/compiler.mjs";
import { diffResearchSemantics, type ResearchSemanticDiff } from "@/lib/research/semantic-evolution.mjs";
import styles from "./ResearchTimelineSemantic.module.css";

const TYPE_SHORT: Record<string, string> = {
  question: "Q",
  hypothesis: "H",
  literature: "L",
  experiment: "E",
  result: "R",
  evidence: "EV",
  decision: "D",
  milestone: "M",
  dataset: "DS",
  method: "MT",
  note: "N",
};

function utc(date: string) {
  return Date.parse(date + "T00:00:00Z");
}

function tickDates(min: number, max: number, count = 6) {
  if (max <= min) return [min];
  return Array.from({ length: count }, (_, index) => min + (index / (count - 1)) * (max - min));
}

function semanticSummary(diff: ResearchSemanticDiff) {
  const parts: string[] = [];
  if (diff.summary.fieldChanges) parts.push(`${diff.summary.fieldChanges} field`);
  if (diff.summary.relationshipChanges) parts.push(`${diff.summary.relationshipChanges} relation`);
  if (diff.summary.evidenceSignalChanges) parts.push(`${diff.summary.evidenceSignalChanges} evidence`);
  if (diff.summary.headingChanges) parts.push(`${diff.summary.headingChanges} section`);
  if (diff.summary.tagChanges) parts.push(`${diff.summary.tagChanges} tag`);
  if (diff.summary.assetChanges) parts.push(`${diff.summary.assetChanges} asset`);
  return parts.slice(0, 3).join(" · ") || "Wording-only or no normalized semantic change";
}

export function ResearchTimeline({
  entries,
  projects,
  undatedEntries,
}: {
  entries: ResearchEntry[];
  projects: Array<{ id: string; label: string }>;
  undatedEntries: ResearchEntry[];
}) {
  if (!entries.length) {
    return (
      <div className="timeline-empty panel">
        <strong>No dated research objects yet.</strong>
        <p>Add <code>date: YYYY-MM-DD</code> to research notes to place them on the timeline.</p>
      </div>
    );
  }

  const min = Math.min(...entries.map((entry) => utc(entry.date!)));
  const maxRaw = Math.max(...entries.map((entry) => utc(entry.date!)));
  const max = maxRaw === min ? min + 86400000 : maxRaw;
  const width = 1120;
  const labelWidth = 170;
  const right = 42;
  const top = 54;
  const laneHeight = 112;
  const height = top + projects.length * laneHeight + 42;
  const plot = width - labelWidth - right;
  const xAt = (date: string) => labelWidth + ((utc(date) - min) / (max - min)) * plot;
  const projectIndex = new Map(projects.map((project, index) => [project.id, index]));
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));

  const collisionGroups = new Map<string, ResearchEntry[]>();
  for (const entry of entries) {
    const key = `${entry.research}|${entry.date}`;
    const group = collisionGroups.get(key) ?? [];
    group.push(entry);
    collisionGroups.set(key, group);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const entry of entries) {
    const lane = projectIndex.get(entry.research);
    if (lane === undefined) continue;
    const group = collisionGroups.get(`${entry.research}|${entry.date}`) ?? [entry];
    const index = group.findIndex((item) => item.slug === entry.slug);
    const spacing = Math.min(23, 72 / Math.max(1, group.length - 1));
    const offset = (index - (group.length - 1) / 2) * spacing;
    positions.set(entry.slug, {
      x: xAt(entry.date!),
      y: top + lane * laneHeight + laneHeight / 2 + offset,
    });
  }

  const supersedes = entries.flatMap((entry) =>
    entry.relationships
      .filter((relation) => relation.type === "supersedes" && bySlug.has(relation.target))
      .map((relation) => {
        const older = bySlug.get(relation.target)!;
        return {
          newer: entry,
          older,
          semantic: diffResearchSemantics(older, entry),
          note: relation.note,
        };
      }),
  );
  const semanticByNewer = new Map<string, ResearchSemanticDiff[]>();
  for (const transition of supersedes) {
    const list = semanticByNewer.get(transition.newer.slug) ?? [];
    list.push(transition.semantic);
    semanticByNewer.set(transition.newer.slug, list);
  }

  return (
    <>
      <div className="timeline-legend">
        <span><i className="version-link" />Version lineage</span>
        <span className={styles.legendDelta}><b>Δ</b> Normalized semantic change on explicit <code>supersedes</code> links</span>
        <span>Each lane is a research project; same-day markers stack without changing their date.</span>
      </div>
      <div className="research-timeline-scroll panel">
        <svg viewBox={`0 0 ${width} ${height}`} className="research-timeline-svg" role="img" aria-label="Multi-project research timeline">
          {tickDates(min, max).map((timestamp) => {
            const x = labelWidth + ((timestamp - min) / (max - min)) * plot;
            const label = new Date(timestamp).toISOString().slice(0, 10);
            return (
              <g key={timestamp}>
                <line x1={x} x2={x} y1={top - 22} y2={height - 28} className="timeline-grid-line" />
                <text x={x} y={top - 30} textAnchor="middle" className="timeline-date-label">{label}</text>
              </g>
            );
          })}

          {projects.map((project, index) => {
            const y = top + index * laneHeight + laneHeight / 2;
            return (
              <g key={project.id}>
                <rect x="0" y={top + index * laneHeight} width={width} height={laneHeight} className={index % 2 ? "timeline-lane alt" : "timeline-lane"} />
                <text x={labelWidth - 18} y={y + 4} textAnchor="end" className="timeline-project-label">{project.label}</text>
                <line x1={labelWidth} x2={width - right} y1={y} y2={y} className="timeline-axis" />
              </g>
            );
          })}

          {supersedes.map(({ newer, older, semantic }) => {
            if (newer.research !== older.research) return null;
            const newerPoint = positions.get(newer.slug);
            const olderPoint = positions.get(older.slug);
            if (!newerPoint || !olderPoint) return null;
            const midX = (olderPoint.x + newerPoint.x) / 2;
            const midY = (olderPoint.y + newerPoint.y) / 2;
            return (
              <g key={`${newer.slug}-${older.slug}`}>
                <line x1={olderPoint.x} x2={newerPoint.x} y1={olderPoint.y} y2={newerPoint.y} className="timeline-version-link" />
                <g className={styles.deltaMarker} aria-label={`${semantic.summary.changedDimensions} semantic dimensions changed`}>
                  <circle cx={midX} cy={midY} r="11" />
                  <text x={midX} y={midY + 3} textAnchor="middle">Δ{semantic.summary.changedDimensions}</text>
                </g>
              </g>
            );
          })}

          {entries.map((entry) => {
            const point = positions.get(entry.slug);
            if (!point) return null;
            const label = TYPE_SHORT[entry.type ?? "note"] ?? "N";
            const semanticTransitions = semanticByNewer.get(entry.slug) ?? [];
            const changed = semanticTransitions.reduce((total, item) => total + item.summary.changedDimensions, 0);
            return (
              <a key={entry.slug} href={`/progress/${entry.slug}`} aria-label={entry.title}>
                <g className={`timeline-event type-${entry.type ?? "note"}`}>
                  {semanticTransitions.length > 0 && <circle cx={point.x} cy={point.y} r="21" className={styles.revisionRing} />}
                  <circle cx={point.x} cy={point.y} r="15" />
                  <text x={point.x} y={point.y + 3.5} textAnchor="middle">{label}</text>
                  <desc>{entry.date} · {entry.title} · {entry.type ?? "note"} · {entry.status ?? "unspecified"}{semanticTransitions.length ? ` · revision with ${changed} semantic dimension changes across ${semanticTransitions.length} predecessor${semanticTransitions.length === 1 ? "" : "s"}` : ""}</desc>
                </g>
              </a>
            );
          })}
        </svg>
      </div>

      {supersedes.length > 0 && (
        <section className={`${styles.revisionSummary} panel`} aria-labelledby="timeline-revision-summary">
          <header>
            <div><span className="kicker">Revision semantics</span><h3 id="timeline-revision-summary">What changed at each explicit version step</h3></div>
            <small>{supersedes.length} supersedes transition{supersedes.length === 1 ? "" : "s"}</small>
          </header>
          <div className={styles.revisionScroller}>
            {supersedes.map(({ newer, older, semantic, note }) => (
              <Link
                key={`${newer.slug}-${older.slug}-summary`}
                href={`/insights?view=versions&research=${encodeURIComponent(newer.research)}&base=${encodeURIComponent(older.slug)}&compare=${encodeURIComponent(newer.slug)}`}
                className={styles.revisionCard}
              >
                <div className={styles.revisionTopline}>
                  <span>{older.date ?? "undated"} → {newer.date ?? "undated"}</span>
                  <strong>Δ{semantic.summary.changedDimensions}</strong>
                </div>
                <b>{older.title} → {newer.title}</b>
                <small>{semanticSummary(semantic)}</small>
                {note && <em>{note}</em>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {undatedEntries.length > 0 && (
        <section className="undated-research panel">
          <div><span className="kicker">Outside timeline</span><h3>{undatedEntries.length} undated research object{undatedEntries.length === 1 ? "" : "s"}</h3></div>
          <div>
            {undatedEntries.map((entry) => <Link key={entry.slug} href={`/progress/${entry.slug}`}><span>{entry.research}</span>{entry.title}</Link>)}
          </div>
        </section>
      )}
    </>
  );
}
