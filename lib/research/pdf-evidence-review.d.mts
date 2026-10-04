export type PdfEvidenceRect = { x: number; y: number; width: number; height: number };
export type PdfPromotionSnapshot = {
  schemaVersion: 1;
  annotationId: string;
  annotationType: string;
  anchorKind: "text" | "region";
  page: number;
  rects: PdfEvidenceRect[];
  documentSha256: string;
  anchorDocumentSha256?: string;
  sourceText?: {
    kind: "caption" | "ocr" | "transcription";
    sha256: string;
    verifiedAt: string;
    anchorDocumentSha256: string;
    anchorPage: number;
  };
  tags?: string[];
};
export type PdfEvidencePreview = {
  workspaceSignature: string;
  annotationRevision: number;
  documentSha256: string;
  proposalHash: string;
  project: { id: string; label: string; directory: string };
  annotation: {
    id: string;
    type: string;
    anchorKind: "text" | "region";
    page: number;
    rects: PdfEvidenceRect[];
    sourceText: PdfPromotionSnapshot["sourceText"] | null;
  };
  snapshot: PdfPromotionSnapshot;
  file: { id: string; title: string; filename: string; content: string };
};
export function pdfEvidenceReviewWritable(): boolean;
export function parsePdfAnnotationPromotionSnapshot(content: string): PdfPromotionSnapshot | null;
export function previewPdfAnnotationEvidence(options?: { rootDir?: string; paperPath?: string; id?: string; expectedRevision?: number }): Promise<PdfEvidencePreview>;
export function applyPdfAnnotationEvidence(options?: { rootDir?: string; paperPath?: string; id?: string; expectedRevision?: number; expectedWorkspaceSignature?: string; expectedDocumentSha256?: string; expectedProposalHash?: string }): Promise<{ slug: string; filename: string; title: string; research: string; snapshot: PdfPromotionSnapshot; workspaceSignature: string }>;
