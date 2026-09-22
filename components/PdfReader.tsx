"use client";

import dynamic from "next/dynamic";

const PdfReaderInner = dynamic(() => import("@/components/PdfReaderInner"), {
  ssr: false,
  loading: () => <div className="pdf-loading panel">Loading PDF workspace…</div>,
});

export type PdfRelatedNote = { slug: string; order: number; title: string; type?: string };

export function PdfReader(props: {
  src: string;
  path: string;
  title: string;
  initialPage: number;
  relatedNotes: PdfRelatedNote[];
}) {
  return <PdfReaderInner {...props} />;
}
