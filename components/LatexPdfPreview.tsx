"use client";

import { Document, Page, pdfjs } from "react-pdf";
import type { MouseEvent, ReactNode } from "react";

pdfjs.GlobalWorkerOptions.workerSrc = "/_research/pdfjs/pdf.worker.min.mjs";

const options = {
  cMapUrl: "/_research/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/_research/pdfjs/standard_fonts/",
  wasmUrl: "/_research/pdfjs/wasm/",
};

export function LatexPdfPreview({
  file,
  pageNumber,
  width,
  className,
  title,
  onDoubleClick,
  onDocumentLoad,
  onPageLoad,
  children,
}: {
  file: string;
  pageNumber: number;
  width: number;
  className: string;
  title?: string;
  onDoubleClick: (event: MouseEvent<HTMLDivElement>) => void;
  onDocumentLoad: (pages: number) => void;
  onPageLoad: (width: number, height: number) => void;
  children?: ReactNode;
}) {
  return (
    <Document
      file={file}
      options={options}
      onLoadSuccess={(document) => onDocumentLoad(document.numPages)}
      loading={<p>Loading compiled PDF…</p>}
      error={<p>Could not render the compiled PDF.</p>}
    >
      <div className={className} onDoubleClick={onDoubleClick} title={title}>
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer
          renderAnnotationLayer
          onLoadSuccess={(page) => {
            const viewport = page.getViewport({ scale: 1 });
            onPageLoad(viewport.width, viewport.height);
          }}
        />
        {children}
      </div>
    </Document>
  );
}

export default LatexPdfPreview;
