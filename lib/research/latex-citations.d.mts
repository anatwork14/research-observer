export type LatexCitationCandidate = {
  slug: string;
  title: string;
  bibliographicTitle: string;
  type: string;
  sourceKind: string;
  authors: string[];
  year?: number;
  doi?: string;
  url?: string;
  pdfPath?: string;
  metadataSlug: string;
  metadataTitle: string;
  citationReady: boolean;
  missing: string[];
  researchHref: string;
  paperHref: string | null;
};

export type LatexCitationReference = {
  key: string;
  file: string;
  start: number;
  end: number;
  bibFiles: string[];
  status: "resolved" | "ambiguous" | "missing";
  choices: LatexCitationCandidate[];
};

export function listLatexCitationCandidates(options?: {
  rootDir?: string;
  projectId?: string;
  query?: string;
}): Promise<{
  project: { id: string; label: string };
  items: LatexCitationCandidate[];
  bibFiles: string[];
  defaultBibFile: string;
}>;

export function resolveLatexCitationTokens(options: {
  rootDir?: string;
  projectId?: string;
  file: string;
  content?: string;
}): Promise<{ file: string; citations: LatexCitationReference[] }>;

export function ensureLatexCitation(options: {
  rootDir?: string;
  projectId?: string;
  slug: string;
  bibFile?: string;
}): Promise<{
  created: boolean;
  bibFileCreated: boolean;
  key: string;
  bibFile: string;
  bibtex?: string;
  candidate: LatexCitationCandidate;
}>;
