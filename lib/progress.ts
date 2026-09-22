import path from "node:path";
import {
  compileResearchWorkspace,
  type ResearchEntry,
  type ResearchWorkspace,
} from "@/lib/research/compiler.mjs";

export type ProgressEntry = ResearchEntry;

export async function getResearchWorkspace(): Promise<ResearchWorkspace> {
  return compileResearchWorkspace();
}

export async function getProgressEntries(): Promise<ProgressEntry[]> {
  return (await getResearchWorkspace()).entries;
}

export async function getProgressEntry(slug: string): Promise<ProgressEntry | null> {
  const entries = await getProgressEntries();
  return entries.find((entry) => entry.slug === slug || entry.aliases.includes(slug)) ?? null;
}

export function progressDir() {
  return path.join(process.cwd(), "progress");
}
