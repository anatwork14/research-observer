export type PdfAnnotationType =
  | "highlight"
  | "comment"
  | "evidence"
  | "claim"
  | "question"
  | "limitation"
  | "method"
  | "definition"
  | "important"
  | "area"
  | "figure"
  | "table";

export type PdfAnnotationAnchorKind = "text" | "region";
export type PdfAnnotationAnchorStatus = "current" | "stale" | "legacy";
export type PdfAnnotationRect = { x: number; y: number; width: number; height: number };
export type PdfAnnotationQuote = { exact: string; prefix?: string; suffix?: string };
export type PdfAnnotationEvidenceLink = { slug: string; title: string; filename: string };
export type PdfAnnotationAnchor = {
  kind: PdfAnnotationAnchorKind;
  documentSha256: string;
  pageTextSha256?: string;
  pageTextIndex?: number;
  confidence: number;
  anchoredAt: string;
};
export type PdfAnnotationAnchorHistory = {
  page: number;
  anchorKind: PdfAnnotationAnchorKind;
  quote: PdfAnnotationQuote;
  rects: PdfAnnotationRect[];
  anchor: PdfAnnotationAnchor | null;
  recordedAt: string;
};
export type PdfAnnotation = {
  id: string;
  type: PdfAnnotationType;
  page: number;
  anchorKind: PdfAnnotationAnchorKind;
  quote: PdfAnnotationQuote;
  rects: PdfAnnotationRect[];
  anchor: PdfAnnotationAnchor | null;
  anchorHistory: PdfAnnotationAnchorHistory[];
  anchorStatus?: PdfAnnotationAnchorStatus;
  comment: string;
  tags: string[];
  color: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  evidence?: PdfAnnotationEvidenceLink | null;
};

export type PdfAnnotationState = {
  schemaVersion: number;
  revision: number;
  paper: { path: string; project: string; size: number };
  document: { sha256: string; size: number; mtimeMs: number; staleCount: number; legacyCount: number } | null;
  project: string;
  updatedAt: string | null;
  annotations: PdfAnnotation[];
  hiddenCount: number;
};

type PdfAnchorInput = {
  page: number;
  anchorKind?: PdfAnnotationAnchorKind;
  quote?: PdfAnnotationQuote;
  rects: PdfAnnotationRect[];
  pageTextSha256?: string;
  pageTextIndex?: number;
};

export const pdfAnnotationTypes: PdfAnnotationType[];
export function listPdfAnnotations(options: { rootDir?: string; paperPath: string; includeDeleted?: boolean }): Promise<PdfAnnotationState>;
export function createPdfAnnotation(options: { rootDir?: string; paperPath: string; expectedRevision?: number; annotation: Partial<PdfAnnotation> & PdfAnchorInput }): Promise<PdfAnnotationState & { annotation: PdfAnnotation }>;
export function updatePdfAnnotation(options: { rootDir?: string; paperPath: string; id: string; expectedRevision?: number; patch: Partial<Pick<PdfAnnotation, "type" | "comment" | "tags" | "color">> }): Promise<PdfAnnotationState & { annotation: PdfAnnotation }>;
export function reanchorPdfAnnotation(options: { rootDir?: string; paperPath: string; id: string; expectedRevision?: number; anchor: PdfAnchorInput }): Promise<PdfAnnotationState & { annotation: PdfAnnotation }>;
export function softDeletePdfAnnotation(options: { rootDir?: string; paperPath: string; id: string; expectedRevision?: number }): Promise<PdfAnnotationState & { annotation: PdfAnnotation }>;
export function restorePdfAnnotation(options: { rootDir?: string; paperPath: string; id: string; expectedRevision?: number }): Promise<PdfAnnotationState & { annotation: PdfAnnotation }>;
export function promotePdfAnnotationToEvidence(options: { rootDir?: string; paperPath: string; id: string; expectedRevision?: number }): Promise<PdfAnnotationState & { evidence: PdfAnnotationEvidenceLink; existing: boolean }>;
