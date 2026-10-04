"use client";

import dynamic from "next/dynamic";
import { PdfAnnotationBridge } from "@/components/PdfAnnotationBridge";
import { PdfEvidenceReviewLauncher } from "@/components/PdfEvidenceReviewLauncher";
import { PdfReanchorSuggestions } from "@/components/PdfReanchorSuggestions";

const PdfReaderInner = dynamic(() => import("@/components/PdfReaderInner"), {
  ssr: false,
  loading: () => <div className="pdf-loading panel">Loading PDF workspace…</div>,
});

export type PdfRelatedNote = { slug: string; order: number; title: string; type?: string; sourcePage?: number };

export function PdfReader(props: {
  src: string;
  path: string;
  title: string;
  initialPage: number;
  relatedNotes: PdfRelatedNote[];
  relationshipTypes: string[];
  relationshipTargets: Array<{ slug: string; title: string; type?: string }>;
}) {
  return (
    <>
      <PdfReaderInner {...props} />
      <PdfAnnotationBridge paperPath={props.path} />
      <PdfEvidenceReviewLauncher paperPath={props.path} />
      <PdfReanchorSuggestions paperPath={props.path} src={props.src} />
    </>
  );
}
