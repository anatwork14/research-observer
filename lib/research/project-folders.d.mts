export const PROJECT_MANIFEST: string;
export const PROJECT_IMPORT_PREFIX: string;

export type FolderResearchProject = {
  id: string;
  label: string;
  description?: string;
  directory: string;
  source: "folder";
};

export type ProjectFolderIssue = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  file?: string;
};

export function projectIdFromFolder(value: unknown): string;
export function projectLabelFromFolder(value: unknown): string;
export function projectDirectoryForFile(relativePath: unknown): string | undefined;
export function discoverProjectFolders(options?: {
  progressRoot?: string;
  files?: Array<{ rel: string }>;
}): Promise<{
  projects: FolderResearchProject[];
  byDirectory: Map<string, FolderResearchProject>;
  issues: ProjectFolderIssue[];
}>;
export function projectManifest(project: { id: string; label: string; description?: string }): string;
