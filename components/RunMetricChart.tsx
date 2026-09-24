"use client";

import { useState } from "react";

export type MeasurementPoint = { x: string; value: number };

export function RunMetricChart({ title, unit, mode, points }: { title: string; unit: string; mode: "time" | "distribution"; points: MeasurementPoint[] }) {
  const [page, setPage] = useState(0), pageSize = 100;
  if (!points.length) return null;
  const values = points.map((point) => point.value), min = Math.min(...values), max = Math.max(...values), spread = max - min || 1;
  const bins = Array.from({ length: 10 }, () => 0);
  for (const value of values) bins[Math.min(9, Math.floor(((value - min) / spread) * 10))]++;
  const maximumBin = Math.max(...bins, 1);
  const shown = points.slice(page * pageSize, (page + 1) * pageSize);
  const pointString = points.slice(0, 1500).map((point, index) => `${(index / Math.max(1, Math.min(points.length, 1500) - 1)) * 600},${160 - ((point.value - min) / spread) * 145}`).join(" ");
  return <section style={{ marginTop: "1rem" }}>
    <h3>{title} · {mode === "time" ? "time series" : "distribution"}</h3>
    <svg role="img" aria-label={`${mode === "time" ? "Line chart" : "Histogram"} for ${title}; ${points.length} values in ${unit}`} viewBox="0 0 620 200" style={{ display: "block", width: "100%", maxWidth: 760, height: "auto", background: "var(--surface-muted)", borderRadius: 12 }}>
      {mode === "time" ? <><line x1="10" y1="160" x2="610" y2="160" stroke="currentColor" opacity=".25" /><polyline points={pointString} fill="none" stroke="var(--accent)" strokeWidth="3" vectorEffect="non-scaling-stroke" /><text x="10" y="188" fontSize="12" fill="currentColor">{points[0].x}</text><text x="550" y="188" fontSize="12" fill="currentColor">{points.at(-1)?.x}</text></> : bins.map((count, index) => <g key={index}><rect x={20 + index * 58} y={165 - (count / maximumBin) * 140} width="42" height={(count / maximumBin) * 140} fill="var(--accent)" rx="4" /><text x={20 + index * 58} y="186" fontSize="10" fill="currentColor">{(min + spread * index / 10).toPrecision(2)}</text></g>)}
    </svg>
    <p>{points.length} measured values · min {min} · max {max} · unit {unit}. All values are listed below.</p>
    <details><summary>Underlying measurements ({points.length})</summary><div style={{ maxWidth: "100%", overflowX: "auto" }}><table><thead><tr><th>Index</th><th>{mode === "time" ? "Time / step" : "Observation"}</th><th>Value</th></tr></thead><tbody>{shown.map((point, index) => <tr key={page * pageSize + index}><td>{page * pageSize + index + 1}</td><td>{point.x}</td><td>{point.value} {unit}</td></tr>)}</tbody></table></div><nav aria-label="Measurement pages" style={{ display: "flex", gap: ".7rem", alignItems: "center", marginTop: ".6rem" }}><button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button><span>{page + 1} / {Math.max(1, Math.ceil(points.length / pageSize))}</span><button disabled={(page + 1) * pageSize >= points.length} onClick={() => setPage((value) => value + 1)}>Next</button></nav></details>
  </section>;
}
