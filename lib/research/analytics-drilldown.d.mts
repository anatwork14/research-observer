import type { ResearchEntry, ResearchWorkspace } from "./compiler.mjs";
import type { ResearchAnalytics } from "./analytics.mjs";

export type AnalyticsDrilldownFilters = {
  focus: "" | "type" | "status" | "relation" | "month" | "project" | "health" | "cross-project" | "evidence-signal";
  value: string;
  project: string;
  sourceProject: string;
  targetProject: string;
};

export type AnalyticsRelationRow = {
  source: ResearchEntry;
  target?: ResearchEntry;
  relation: NonNullable<ResearchEntry["relationships"]>[number];
};

export type AnalyticsDrilldown = {
  kind: "entries" | "relations";
  title: string;
  description: string;
  entries: ResearchEntry[];
  relations: AnalyticsRelationRow[];
  count: number;
};

export function normalizeAnalyticsDrilldown(input?: Partial<AnalyticsDrilldownFilters>): AnalyticsDrilldownFilters;
export function hasAnalyticsDrilldown(filters?: Partial<AnalyticsDrilldownFilters>): boolean;
export function buildAnalyticsDrilldown(options?: {
  workspace?: ResearchWorkspace;
  analytics?: ResearchAnalytics;
  filters?: Partial<AnalyticsDrilldownFilters>;
}): AnalyticsDrilldown | null;
export function buildEvidenceSignalSummary(entries?: ResearchEntry[]): {
  evidence: number;
  signals: number;
  supports: number;
  contradicts: number;
  answers: number;
  targetsWithSignals: number;
  targetsWithoutSignals: number;
};
