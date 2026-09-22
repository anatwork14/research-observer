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
  date?: string;
  tags: string[];
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
    maxAssetBytes: number;
    [key: string]: unknown;
  };
  signature: string;
  entries: ResearchEntry[];
  assets: Array<{ path: string; extension: string; size: number }>;
  diagnostics: ResearchDiagnostic[];
  stats: {
    notes: number;
    links: number;
    assets: number;
    errors: number;
    warnings: number;
  };
};

export function compileResearchWorkspace(options?: { rootDir?: string; fresh?: boolean }): Promise<ResearchWorkspace>;
export function writeResearchArtifacts(options?: { rootDir?: string; fresh?: boolean }): Promise<ResearchWorkspace>;
