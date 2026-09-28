export type PdfReanchorPageText = { page: number; text: string };
export type PdfReanchorHint = { page?: number; pageTextIndex?: number } | null;
export type PdfReanchorCandidate = {
  id: string;
  page: number;
  start: number;
  end: number;
  matchedText: string;
  snippet: string;
  matchType: "exact" | "fuzzy";
  confidence: number;
  contextScore: number;
};

export function findPdfReanchorCandidates(options: {
  pages: PdfReanchorPageText[];
  quote: string;
  prefix?: string;
  suffix?: string;
  hint?: PdfReanchorHint;
  limit?: number;
}): PdfReanchorCandidate[];
