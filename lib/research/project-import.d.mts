import type { ResearchProjectSummary } from "./compiler.mjs";

export function projectImportWritable(): boolean;
export function projectImportReason(): string;

export function importResearchProject(options?: {
  rootDir?: string;
  projectName?: string;
  files?: Array<{
    name?: string;
    relativePath?: string;
    data?: Uint8Array | string;
  }>;
}): Promise<{
  imported: true;
  directory: string;
  project: ResearchProjectSummary;
  files: number;
  bytes: number;
  storagePath: string;
}>;
