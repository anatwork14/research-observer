import type { ResearchEntry, ResearchWorkspace } from "./compiler.mjs";

export type ResearchAnalytics = ReturnType<typeof buildResearchAnalytics>;

export function selectedResearchIds(workspace: ResearchWorkspace, requested?: string[]): string[];
export function entriesForResearch(entries: ResearchEntry[], researchIds?: string[]): ResearchEntry[];
export function buildVersionGroups(entries?: ResearchEntry[]): Array<{
  id: string;
  title: string;
  research: string;
  versions: ResearchEntry[];
  edges: Array<{ newer: string; older: string }>;
}>;
export function diffResearchVersions(base?: ResearchEntry, compare?: ResearchEntry, limit?: number): {
  lines: Array<{ type: "same" | "added" | "removed"; text: string }>;
  added: number;
  removed: number;
  unchanged: number;
  truncated: boolean;
};
export function buildResearchAnalytics(workspace: ResearchWorkspace, researchIds?: string[]): {
  researchIds: string[];
  entries: ResearchEntry[];
  projects: Array<ResearchWorkspace["projects"][number] & { completion: number }>;
  totals: {
    notes: number;
    active: number;
    words: number;
    dated: number;
    evidence: number;
    papers: number;
    relationships: number;
    crossProjectRelationships: number;
  };
  types: Array<{ key: string; label: string; value: number }>;
  statuses: Array<{ key: string; label: string; value: number }>;
  relationships: Array<{ key: string; label: string; value: number }>;
  pipeline: Array<{ key: string; label: string; value: number }>;
  activity: Array<{ month: string; total: number; evidence: number; experiments: number; results: number }>;
  healthRows: Array<{ id: string; label: string; issues: Array<{ key: string; label: string; value: number }> }>;
  crossProject: Array<{ source: string; sourceResearch: string; target: string; targetResearch: string; type: string }>;
  timelineEntries: ResearchEntry[];
  undatedEntries: ResearchEntry[];
  versionGroups: ReturnType<typeof buildVersionGroups>;
};
