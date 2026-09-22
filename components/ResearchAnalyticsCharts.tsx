import type { ReactNode } from "react";

type Datum = { key: string; label: string; value: number };
type Activity = { month: string; total: number; evidence: number; experiments: number; results: number };

const TONES = ["tone-0", "tone-1", "tone-2", "tone-3", "tone-4", "tone-5", "tone-6", "tone-7"];

function emptyChart(message: string) {
  return <div className="insight-chart-empty">{message}</div>;
}

export function InsightCard({
  title,
  eyebrow,
  description,
  children,
  className = "",
}: {
  title: string;
  eyebrow: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`insight-chart-card panel ${className}`}>
      <header>
        <div><span className="kicker">{eyebrow}</span><h2>{title}</h2></div>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  );
}

export function HorizontalBarChart({
  data,
  ariaLabel,
}: {
  data: Datum[];
  ariaLabel: string;
}) {
  if (!data.length) return emptyChart("No data in the selected research scope.");
  const width = 720;
  const labelWidth = 190;
  const right = 54;
  const row = 38;
  const top = 12;
  const height = top * 2 + data.length * row;
  const max = Math.max(1, ...data.map((item) => item.value));
  const plot = width - labelWidth - right;

  return (
    <div className="insight-svg-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} className="insight-bar-svg" role="img" aria-label={ariaLabel}>
        {data.map((item, index) => {
          const y = top + index * row;
          const barWidth = (item.value / max) * plot;
          return (
            <g key={item.key}>
              <text x={labelWidth - 12} y={y + 20} textAnchor="end" className="insight-axis-label">{item.label}</text>
              <rect x={labelWidth} y={y + 7} width={plot} height="18" rx="5" className="insight-bar-track" />
              <rect x={labelWidth} y={y + 7} width={barWidth} height="18" rx="5" className={`insight-bar ${TONES[index % TONES.length]}`} />
              <text x={Math.min(labelWidth + barWidth + 8, width - right + 8)} y={y + 20} className="insight-value">{item.value}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DonutChart({
  data,
  ariaLabel,
}: {
  data: Datum[];
  ariaLabel: string;
}) {
  const visible = data.filter((item) => item.value > 0);
  if (!visible.length) return emptyChart("No status data in the selected research scope.");
  const total = visible.reduce((sum, item) => sum + item.value, 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="insight-donut-layout">
      <svg viewBox="0 0 180 180" className="insight-donut-svg" role="img" aria-label={ariaLabel}>
        <circle cx="90" cy="90" r={radius} className="insight-donut-track" />
        {visible.map((item, index) => {
          const length = (item.value / total) * circumference;
          const element = (
            <circle
              key={item.key}
              cx="90"
              cy="90"
              r={radius}
              className={`insight-donut-segment ${TONES[index % TONES.length]}`}
              strokeDasharray={`${length} ${Math.max(0, circumference - length)}`}
              strokeDashoffset={-offset}
            >
              <title>{item.label}: {item.value}</title>
            </circle>
          );
          offset += length;
          return element;
        })}
        <text x="90" y="85" textAnchor="middle" className="insight-donut-total">{total}</text>
        <text x="90" y="105" textAnchor="middle" className="insight-donut-caption">objects</text>
      </svg>
      <div className="insight-legend">
        {visible.map((item, index) => (
          <div key={item.key}><i className={TONES[index % TONES.length]} /><span>{item.label}</span><strong>{item.value}</strong></div>
        ))}
      </div>
    </div>
  );
}

function points(values: number[], width: number, height: number, padX = 28, padY = 24) {
  const max = Math.max(1, ...values);
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : padX + (index / (values.length - 1)) * (width - padX * 2);
    const y = height - padY - (value / max) * (height - padY * 2);
    return { x, y, value };
  });
}

export function ActivityLineChart({
  data,
}: {
  data: Activity[];
}) {
  if (!data.length) return emptyChart("Add YYYY-MM-DD dates to research notes to unlock activity trends.");
  const width = Math.max(760, data.length * 48);
  const height = 260;
  const series = [
    { key: "total", label: "All dated objects", tone: "tone-0" },
    { key: "evidence", label: "Evidence", tone: "tone-1" },
    { key: "experiments", label: "Experiments", tone: "tone-3" },
    { key: "results", label: "Results", tone: "tone-5" },
  ] as const;
  const globalMax = Math.max(1, ...data.flatMap((row) => series.map((item) => Number(row[item.key]))));
  const plotTop = 22;
  const plotBottom = height - 40;
  const xAt = (index: number) => data.length === 1 ? width / 2 : 34 + (index / (data.length - 1)) * (width - 68);
  const yAt = (value: number) => plotBottom - (value / globalMax) * (plotBottom - plotTop);

  return (
    <>
      <div className="insight-series-legend">
        {series.map((item) => <span key={item.key}><i className={item.tone} />{item.label}</span>)}
      </div>
      <div className="insight-svg-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} className="insight-line-svg" role="img" aria-label="Research activity over time">
          {[0, .25, .5, .75, 1].map((fraction) => {
            const y = yAt(globalMax * fraction);
            return <line key={fraction} x1="34" x2={width - 34} y1={y} y2={y} className="insight-grid-line" />;
          })}
          {series.map((item) => {
            const path = data.map((row, index) => `${index ? "L" : "M"} ${xAt(index)} ${yAt(Number(row[item.key]))}`).join(" ");
            return (
              <g key={item.key} className={item.tone}>
                <path d={path} className="insight-line" />
                {data.map((row, index) => (
                  <circle key={row.month} cx={xAt(index)} cy={yAt(Number(row[item.key]))} r="3.5" className="insight-point">
                    <title>{row.month} · {item.label}: {row[item.key]}</title>
                  </circle>
                ))}
              </g>
            );
          })}
          {data.map((row, index) => {
            const show = data.length <= 10 || index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 8) === 0;
            return show ? <text key={row.month} x={xAt(index)} y={height - 14} textAnchor="middle" className="insight-axis-label">{row.month}</text> : null;
          })}
        </svg>
      </div>
    </>
  );
}

export function PipelineChart({ data }: { data: Datum[] }) {
  if (!data.length) return emptyChart("No research-stage data available.");
  const width = 760;
  const height = 270;
  const left = 36;
  const bottom = 58;
  const top = 20;
  const max = Math.max(1, ...data.map((item) => item.value));
  const slot = (width - left * 2) / data.length;
  const barWidth = Math.min(62, slot * .62);
  return (
    <div className="insight-svg-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} className="insight-pipeline-svg" role="img" aria-label="Research pipeline composition">
        {data.map((item, index) => {
          const h = (item.value / max) * (height - bottom - top);
          const x = left + index * slot + (slot - barWidth) / 2;
          const y = height - bottom - h;
          return (
            <g key={item.key}>
              <rect x={x} y={top} width={barWidth} height={height - bottom - top} rx="7" className="insight-bar-track" />
              <rect x={x} y={y} width={barWidth} height={h} rx="7" className={`insight-bar ${TONES[index % TONES.length]}`} />
              <text x={x + barWidth / 2} y={Math.max(top + 14, y - 7)} textAnchor="middle" className="insight-value">{item.value}</text>
              <text x={x + barWidth / 2} y={height - 31} textAnchor="middle" className="insight-axis-label">{item.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type ProjectRow = {
  id: string;
  label: string;
  questions: number;
  hypotheses: number;
  experiments: number;
  results: number;
  evidence: number;
  decisions: number;
};

export function ProjectCompositionChart({ projects }: { projects: ProjectRow[] }) {
  if (!projects.length) return emptyChart("No projects selected.");
  const keys = [
    ["questions", "Questions"],
    ["hypotheses", "Hypotheses"],
    ["experiments", "Experiments"],
    ["results", "Results"],
    ["evidence", "Evidence"],
    ["decisions", "Decisions"],
  ] as const;
  const width = 820;
  const labelWidth = 170;
  const right = 38;
  const row = 48;
  const height = projects.length * row + 28;
  const maxTotal = Math.max(1, ...projects.map((project) => keys.reduce((sum, [key]) => sum + Number(project[key]), 0)));
  const plot = width - labelWidth - right;

  return (
    <>
      <div className="insight-series-legend compact">
        {keys.map(([, label], index) => <span key={label}><i className={TONES[index]} />{label}</span>)}
      </div>
      <div className="insight-svg-scroll">
        <svg viewBox={`0 0 ${width} ${height}`} className="insight-project-svg" role="img" aria-label="Research project composition">
          {projects.map((project, projectIndex) => {
            const y = 14 + projectIndex * row;
            let x = labelWidth;
            const total = keys.reduce((sum, [key]) => sum + Number(project[key]), 0);
            return (
              <g key={project.id}>
                <text x={labelWidth - 12} y={y + 21} textAnchor="end" className="insight-axis-label">{project.label}</text>
                <rect x={labelWidth} y={y + 7} width={plot} height="20" rx="5" className="insight-bar-track" />
                {keys.map(([key, label], index) => {
                  const value = Number(project[key]);
                  const segment = (value / maxTotal) * plot;
                  const node = value > 0 ? (
                    <rect key={key} x={x} y={y + 7} width={segment} height="20" className={`insight-bar ${TONES[index]}`}>
                      <title>{project.label} · {label}: {value}</title>
                    </rect>
                  ) : null;
                  x += segment;
                  return node;
                })}
                <text x={labelWidth + (total / maxTotal) * plot + 7} y={y + 21} className="insight-value">{total}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

type HealthRow = { id: string; label: string; issues: Array<{ key: string; label: string; value: number }> };

export function HealthHeatmap({ rows }: { rows: HealthRow[] }) {
  if (!rows.length) return emptyChart("No projects selected.");
  const columns = rows[0]?.issues ?? [];
  const max = Math.max(1, ...rows.flatMap((row) => row.issues.map((issue) => issue.value)));
  return (
    <div className="health-heatmap-scroll">
      <div className="health-heatmap" style={{ gridTemplateColumns: `minmax(130px, 1.2fr) repeat(${columns.length}, minmax(62px, .7fr))` }}>
        <div />
        {columns.map((column) => <div key={column.key} className="health-heatmap-heading" title={column.label}>{column.label}</div>)}
        {rows.map((row) => (
          <div className="health-heatmap-row" key={row.id} style={{ display: "contents" }}>
            <strong>{row.label}</strong>
            {row.issues.map((issue) => {
              const level = issue.value === 0 ? 0 : Math.max(1, Math.ceil((issue.value / max) * 4));
              return <span key={issue.key} className={`health-heatmap-cell level-${level}`} title={`${row.label} · ${issue.label}: ${issue.value}`}>{issue.value}</span>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

type CrossProjectEdge = {
  sourceResearch: string;
  targetResearch: string;
  type: string;
};

export function CrossProjectMatrix({
  projects,
  edges,
}: {
  projects: Array<{ id: string; label: string }>;
  edges: CrossProjectEdge[];
}) {
  if (projects.length < 2) return emptyChart("Select two or more research projects to inspect cross-project relationships.");
  const counts = new Map<string, number>();
  for (const edge of edges) {
    const key = `${edge.sourceResearch}→${edge.targetResearch}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());
  return (
    <div className="project-matrix-scroll">
      <div className="project-matrix" style={{ gridTemplateColumns: `minmax(130px, 1fr) repeat(${projects.length}, minmax(78px, 1fr))` }}>
        <div className="project-matrix-corner">from ↓ / to →</div>
        {projects.map((project) => <strong key={project.id}>{project.label}</strong>)}
        {projects.map((source) => (
          <div key={source.id} style={{ display: "contents" }}>
            <strong>{source.label}</strong>
            {projects.map((target) => {
              if (source.id === target.id) return <span key={target.id} className="project-matrix-cell diagonal">—</span>;
              const value = counts.get(`${source.id}→${target.id}`) ?? 0;
              const level = value === 0 ? 0 : Math.max(1, Math.ceil((value / max) * 4));
              return <span key={target.id} className={`project-matrix-cell level-${level}`} title={`${source.label} → ${target.label}: ${value} typed relationships`}>{value}</span>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
