import fs from "node:fs";
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
  const root = process.cwd();
  let configured = "progress";
  try {
    const raw = fs.readFileSync(path.join(root, "research-observer.config.json"), "utf8");
    const parsed = JSON.parse(raw) as { progressDir?: unknown };
    if (typeof parsed.progressDir === "string" && parsed.progressDir.trim()) configured = parsed.progressDir.trim();
  } catch {
    // Keep the compiler's default when the optional config cannot be read here.
  }

  const resolved = path.resolve(root, configured);
  if (resolved === root || !resolved.startsWith(root + path.sep)) return path.join(root, "progress");
  return resolved;
}
