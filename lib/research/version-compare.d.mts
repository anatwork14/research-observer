import type { ResearchEntry, ResearchWorkspace } from "./compiler.mjs";

export type ResearchVersionDiffLine = {
  kind: "unchanged" | "added" | "removed" | "ellipsis";
  text: string;
};

export type ResearchVersionComparison = {
  id: string;
  older: { slug: string; title: string; date?: string; status?: string; words: number; href: string };
  newer: { slug: string; title: string; date?: string; status?: string; words: number; href: string };
  wordDelta: number;
  headings: { added: string[]; removed: string[] };
  diff: ResearchVersionDiffLine[];
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
  truncated: boolean;
};

export function compareResearchVersions(older: ResearchEntry, newer: ResearchEntry): ResearchVersionComparison;
export function buildResearchVersionComparisons(workspace: ResearchWorkspace, options?: { projectId?: string }): ResearchVersionComparison[];
