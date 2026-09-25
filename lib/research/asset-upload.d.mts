export function uploadPaper(options: { rootDir?: string; file?: unknown; research?: string }): Promise<{
  path: string;
  filename: string;
  bytes: number;
}>;

export function uploadEvidence(options: {
  rootDir?: string;
  file?: unknown;
  title?: string;
  comment?: string;
  research?: string;
}): Promise<{
  slug: string;
  filename: string;
  assetPath: string;
  bytes: number;
}>;
