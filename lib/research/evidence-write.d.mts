export function createEvidenceNote(options: {
  rootDir?: string;
  paperPath: string;
  page: number;
  quote: string;
  comment?: string;
  relationship?: { type: string; target: string };
}): Promise<{ id: string; slug: string; filename: string; order: number; research: string }>;
