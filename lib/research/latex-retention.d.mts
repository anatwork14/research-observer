export type LatexBuildRetentionResult = {
  project: string;
  retention: number;
  retained: string[];
  removed: string[];
};

export function latexBuildRetention(value?: string | number): number;
export function pruneLatexBuilds(options?: {
  rootDir?: string;
  projectId?: string;
  keep?: string | number;
}): Promise<LatexBuildRetentionResult>;
