import type { NormalizedClaimEvidenceAuditFilters } from "@/lib/research/claim-evidence-audit-filters.mjs";
import { claimAuditFilterHref } from "@/lib/research/claim-evidence-audit-filters.mjs";

const TONES = ["tone-0", "tone-1", "tone-2", "tone-3", "tone-4", "tone-5", "tone-6", "tone-7"];

type Datum = { key: string; label: string; value: number };
type EvidenceDatum = Datum & { slug: string; projectId: string };

type DrilldownProps = {
  researchScope: string[];
  filters: NormalizedClaimEvidenceAuditFilters;
};

function emptyChart(message: string) {
  return <div className="insight-chart-empty">{message}</div>;
}

function LinkedHorizontalBarChart({
  data,
  ariaLabel,
  hrefForDatum,
}: {
  data: Datum[];
  ariaLabel: string;
  hrefForDatum: (item: Datum) => string;
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
            <a href={hrefForDatum(item)} key={item.key} aria-label={`Filter Claims by ${item.label}: ${item.value}`}>
              <g>
                <text x={labelWidth - 12} y={y + 20} textAnchor="end" className="insight-axis-label">{item.label}</text>
                <rect x={labelWidth} y={y + 7} width={plot} height="18" rx="5" className="insight-bar-track" />
                <rect x={labelWidth} y={y + 7} width={barWidth} height="18" rx="5" className={`insight-bar ${TONES[index % TONES.length]}`} />
                <text x={Math.min(labelWidth + barWidth + 8, width - right + 8)} y={y + 20} className="insight-value">{item.value}</text>
              </g>
            </a>
          );
        })}
      </svg>
    </div>
  );
}

function LinkedDonutChart({
  data,
  ariaLabel,
  hrefForDatum,
}: {
  data: Datum[];
  ariaLabel: string;
  hrefForDatum: (item: Datum) => string;
}) {
  const visible = data.filter((item) => item.value > 0);
  if (!visible.length) return emptyChart("No Claim coverage data in the selected research scope.");
  const total = visible.reduce((sum, item) => sum + item.value, 0);
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const segments = visible.reduce<Array<{ item: Datum; index: number; length: number; offset: number }>>((result, item, index) => {
    const length = (item.value / total) * circumference;
    const offset = result.at(-1)?.offset ?? 0;
    const previousLength = result.at(-1)?.length ?? 0;
    result.push({ item, index, length, offset: offset + previousLength });
    return result;
  }, []);

  return (
    <div className="insight-donut-layout">
      <svg viewBox="0 0 180 180" className="insight-donut-svg" role="img" aria-label={ariaLabel}>
        <circle cx="90" cy="90" r={radius} className="insight-donut-track" />
        {segments.map(({ item, index, length, offset }) => (
          <a href={hrefForDatum(item)} key={item.key} aria-label={`Filter Claims by ${item.label}: ${item.value}`}>
            <circle
              cx="90"
              cy="90"
              r={radius}
              className={`insight-donut-segment ${TONES[index % TONES.length]}`}
              strokeDasharray={`${length} ${Math.max(0, circumference - length)}`}
              strokeDashoffset={-offset}
            >
              <desc>{item.label}: {item.value}</desc>
            </circle>
          </a>
        ))}
        <text x="90" y="85" textAnchor="middle" className="insight-donut-total">{total}</text>
        <text x="90" y="105" textAnchor="middle" className="insight-donut-caption">claims</text>
      </svg>
      <div className="insight-legend">
        {visible.map((item, index) => (
          <div key={item.key}>
            <i className={TONES[index % TONES.length]} /><span>{item.label}</span><strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ClaimCoverageDrilldownChart({
  data,
  researchScope,
  filters,
}: DrilldownProps & { data: Datum[] }) {
  return (
    <LinkedDonutChart
      data={data}
      ariaLabel="Distinct Evidence targets per explicit Claim; select a segment to filter the Claim audit"
      hrefForDatum={(item) => claimAuditFilterHref(researchScope, filters, { coverage: item.key as NormalizedClaimEvidenceAuditFilters["coverage"] })}
    />
  );
}

export function ClaimRelationDrilldownChart({
  data,
  researchScope,
  filters,
}: DrilldownProps & { data: Datum[] }) {
  return (
    <LinkedHorizontalBarChart
      data={data}
      ariaLabel="Authored Claim to Evidence relationship types; select a bar to filter the Claim audit"
      hrefForDatum={(item) => claimAuditFilterHref(researchScope, filters, { relation: item.key as NormalizedClaimEvidenceAuditFilters["relation"] })}
    />
  );
}

export function ClaimSignalDrilldownChart({
  data,
  researchScope,
  filters,
}: DrilldownProps & { data: Datum[] }) {
  const relationForSignal: Record<string, NormalizedClaimEvidenceAuditFilters["relation"]> = {
    support: "supports",
    contradiction: "contradicts",
    context: "contextualizes",
    qualification: "qualifies",
  };
  return (
    <LinkedHorizontalBarChart
      data={data}
      ariaLabel="Claims containing explicit authored relation patterns; select a bar to filter the Claim audit"
      hrefForDatum={(item) => item.key === "support-contradiction"
        ? claimAuditFilterHref(researchScope, filters, { signal: "support-contradiction" })
        : claimAuditFilterHref(researchScope, filters, { relation: relationForSignal[item.key] || "" })}
    />
  );
}

export function ClaimEvidenceReuseDrilldownChart({
  data,
  researchScope,
  filters,
}: DrilldownProps & { data: EvidenceDatum[] }) {
  return (
    <LinkedHorizontalBarChart
      data={data}
      ariaLabel="Distinct Claims per linked Evidence object; select a bar to filter the Claim audit"
      hrefForDatum={(item) => claimAuditFilterHref(researchScope, filters, { evidence: (item as EvidenceDatum).slug })}
    />
  );
}
