export function noteCreateWritable(): boolean;
export function createResearchNote(options: {
  rootDir?: string;
  title?: string;
  summary?: string;
  type?: string;
  research?: string;
  body?: string;
}): Promise<{ slug: string; filename: string; title: string; research: string }>;
