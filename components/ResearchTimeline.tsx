import Link from "next/link";
import type { ResearchEntry } from "@/lib/research/compiler.mjs";

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
      .map((relation) => ({ newer: entry, older: bySlug.get(relation.target)! })),
  );

  return (
    <>
      <div className="timeline-legend">
        <span><i className="version-link" />Version lineage</span>
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

          {supersedes.map(({ newer, older }) => {
            if (newer.research !== older.research) return null;
            const newerPoint = positions.get(newer.slug);
            const olderPoint = positions.get(older.slug);
            if (!newerPoint || !olderPoint) return null;
            return <line key={`${newer.slug}-${older.slug}`} x1={olderPoint.x} x2={newerPoint.x} y1={olderPoint.y} y2={newerPoint.y} className="timeline-version-link" />;
          })}

          {entries.map((entry) => {
            const point = positions.get(entry.slug);
            if (!point) return null;
            const label = TYPE_SHORT[entry.type ?? "note"] ?? "N";
            return (
              <a key={entry.slug} href={`/progress/${entry.slug}`} aria-label={entry.title}>
                <g className={`timeline-event type-${entry.type ?? "note"}`}>
                  <circle cx={point.x} cy={point.y} r="15" />
                  <text x={point.x} y={point.y + 3.5} textAnchor="middle">{label}</text>
                  <title>{entry.date} · {entry.title} · {entry.type ?? "note"} · {entry.status ?? "unspecified"}</title>
                </g>
              </a>
            );
          })}
        </svg>
      </div>

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
