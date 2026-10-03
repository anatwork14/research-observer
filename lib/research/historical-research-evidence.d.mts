export type HistoricalResearchEntry = {
  slug: string;
  research: string;
  type?: string;
  title: string;
  file: string;
};

export type HistoricalResearchEvidenceIndex = {
  commit: string;
  projectId: string;
  progressPath: string;
  available: boolean;
  complete: boolean;
  reason?: string;
  entries: HistoricalResearchEntry[];
  bySlug: Record<string, HistoricalResearchEntry[]>;
  stats?: { notes: number; parsed: number };
};

export type HistoricalEvidenceResolution = {
  slug: string;
  status: "valid" | "missing" | "ambiguous" | "cross-project" | "wrong-type" | "unavailable";
  reason?: string;
  research?: string;
  type?: string;
  title?: string;
  file?: string;
  matches?: Array<{ file: string; research: string; type?: string }>;
};

export function loadHistoricalResearchEvidenceIndex(options: {
  rootDir?: string;
  commit: string;
  projectId?: string;
}): Promise<HistoricalResearchEvidenceIndex>;

export function resolveHistoricalEvidenceSlug(
  index: HistoricalResearchEvidenceIndex | undefined,
  slug: string,
  options?: { projectId?: string },
): HistoricalEvidenceResolution;
