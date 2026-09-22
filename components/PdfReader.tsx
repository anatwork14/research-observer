"use client";

import dynamic from "next/dynamic";

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
  return <PdfReaderInner {...props} />;
}
