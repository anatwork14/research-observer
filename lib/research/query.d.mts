import type { ResearchEntry } from "@/lib/research/compiler.mjs";

export type ResearchQueryToken = {
  negated: boolean;
  key?: string;
  value: string;
};

export function parseResearchQuery(input?: string): ResearchQueryToken[];
export function matchesResearchQuery(entry: ResearchEntry, input?: string | ResearchQueryToken[]): boolean;
export function filterResearchEntries(entries: ResearchEntry[], input?: string): ResearchEntry[];
