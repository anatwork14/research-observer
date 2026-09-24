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

export type ResearchEvidenceSource = {
  kind?: "pdf" | "consensus";
  pdf?: string;
  page?: number;
  url?: string;
  doi?: string;
  paperId?: string;
  query?: string;
};

export type ResearchMetric = {
  id: string; label: string; role: "primary" | "secondary" | "guardrail" | "diagnostic";
  direction: "maximize" | "minimize" | "target"; unit: string; aggregation: string; display: string;
  aliases: string[]; threshold?: unknown; description?: string;
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
  source?: ResearchEvidenceSource;
  evaluationPlan?: { schemaVersion?: number; metrics: ResearchMetric[]; comparisons: Array<Record<string, unknown>>; ablations: Array<Record<string, unknown>>; successCriteria: Array<Record<string, unknown>> };
  experimentSpec?: { schemaVersion: number; evaluationPlan: string; kind: string; factors: Array<Record<string, unknown>>; controlledVariables: string[]; datasets?: string[] };
  candidateMetricDefinitions: Array<{ heading: string; text: string }>;
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

export type ResearchProjectSummary = {
  id: string;
  label: string;
  description?: string;
  directory?: string;
  autoIndexed?: boolean;
  notes: number;
  active: number;
  questions: number;
  hypotheses: number;
  literature: number;
  experiments: number;
  results: number;
  evidence: number;
  evaluations: number;
  decisions: number;
  words: number;
  relationships: number;
  crossProjectRelationships: number;
  errors: number;
  warnings: number;
  firstDate?: string;
  latestDate?: string;
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
  experiments: Array<{
    id: string; experimentId: string; label: string; status: string; timestamps?: Record<string, string>;
    parameters?: Record<string, unknown>; metrics?: Record<string, { value: number; source: Record<string, unknown> }>;
    dataFiles?: Array<string | { path: string }>; artifacts?: unknown[]; notes?: string; manifest: string; project?: string; experimentSlug?: string;
  }>;
  assets: Array<{ path: string; extension: string; size: number }>;
  projects: ResearchProjectSummary[];
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
export function discoverMetricCandidates(content: string): Array<{ heading: string; text: string }>;
