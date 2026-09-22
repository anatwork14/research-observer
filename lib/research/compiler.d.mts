export type ResearchDiagnostic = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  file?: string;
};

export type ResearchHeading = {
  level: number;
  title: string;
};

export type ResearchRelationship = {
  type: string;
  target: string;
  note?: string;
};

export type IncomingResearchRelationship = {
  type: string;
  source: string;
  note?: string;
};

export type ResearchEntry = {
  filename: string;
  fileSlug: string;
  slug: string;
  id?: string;
  aliases: string[];
  order: number;
  title: string;
  summary: string;
  type?: string;
  status?: string;
  research: string;
  date?: string;
  tags: string[];
  authors: string[];
  year?: number;
  doi?: string;
  pdf?: string;
  source?: { pdf: string; page?: number };
  relationships: ResearchRelationship[];
  incomingRelationships: IncomingResearchRelationship[];
  content: string;
  text: string;
  words: number;
  readingMinutes: number;
  headings: ResearchHeading[];
  linkedSlugs: string[];
  backlinks: string[];
  assets: string[];
};

export type ResearchWorkspace = {
  schemaVersion: number;
  rootDir: string;
  progressRoot: string;
  config: {
    progressDir?: string;
    warnOnMissingId?: boolean;
    allowedTypes: string[];
    allowedStatuses: string[];
    allowedMediaExtensions: string[];
    allowedRelationshipTypes: string[];
    maxAssetBytes: number;
    researchProjects: Array<{ id: string; label: string; description?: string }>;
    savedCollections: Array<{ id: string; label: string; description?: string; query: string }>;
    [key: string]: unknown;
  };
  signature: string;
  entries: ResearchEntry[];
  assets: Array<{ path: string; extension: string; size: number }>;
  projects: Array<{
    id: string;
    label: string;
    description?: string;
    notes: number;
    active: number;
    questions: number;
    hypotheses: number;
    literature: number;
    experiments: number;
    results: number;
    evidence: number;
    decisions: number;
    words: number;
    relationships: number;
    crossProjectRelationships: number;
    errors: number;
    warnings: number;
    firstDate?: string;
    latestDate?: string;
  }>;
  graph: {
    nodes: Array<{ slug: string; title: string; type?: string; status?: string; research: string; order: number }>;
    edges: Array<{ source: string; target: string; type: string; explicit: boolean }>;
  };
  health: {
    unansweredQuestions: string[];
    experimentsWithoutResults: string[];
    resultsWithoutExperiment: string[];
    decisionsWithoutBasis: string[];
    literatureMissingPdf: string[];
    literatureMissingDoi: string[];
    evidenceMissingSource: string[];
    missingStableIds: string[];
  };
  diagnostics: ResearchDiagnostic[];
  stats: {
    notes: number;
    links: number;
    relationships: number;
    assets: number;
    errors: number;
    warnings: number;
  };
};

export function compileResearchWorkspace(options?: { rootDir?: string; fresh?: boolean }): Promise<ResearchWorkspace>;
export function writeResearchArtifacts(options?: { rootDir?: string; fresh?: boolean }): Promise<ResearchWorkspace>;
