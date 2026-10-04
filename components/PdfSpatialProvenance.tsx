import Link from "next/link";
import type { PdfPromotionSnapshot } from "@/lib/research/pdf-evidence-review.mjs";
import styles from "./PdfSpatialProvenance.module.css";

function paperUrl(pdf: string, page: number) {
  return "/papers/" + pdf.split("/").map(encodeURIComponent).join("/") + `?page=${page}`;
}

export function PdfSpatialProvenance({ snapshot, pdf }: { snapshot: PdfPromotionSnapshot; pdf: string }) {
  return (
    <section className={`side-card panel ${styles.card}`} aria-label="PDF spatial provenance">
      <div className={styles.heading}>
        <div><span className="kicker">Spatial provenance</span><h3>Frozen PDF region</h3></div>
        <span className={styles.page}>p.{snapshot.page}</span>
      </div>
      <div className={styles.map} aria-label={`Normalized page ${snapshot.page} provenance map`}>
        {snapshot.rects.map((rect, index) => (
          <span key={index} style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }} />
        ))}
      </div>
      <dl className={styles.meta}>
        <div><dt>Annotation</dt><dd>{snapshot.annotationType}</dd></div>
        <div><dt>Anchor</dt><dd>{snapshot.anchorKind}</dd></div>
        <div><dt>Regions</dt><dd>{snapshot.rects.length}</dd></div>
        {snapshot.sourceText && <div><dt>Text provenance</dt><dd>{snapshot.sourceText.kind}</dd></div>}
      </dl>
      <details className={styles.hashes}>
        <summary>Integrity fingerprints</summary>
        <code>PDF {snapshot.documentSha256}</code>
        {snapshot.sourceText && <code>Text {snapshot.sourceText.sha256}</code>}
      </details>
      <Link className={styles.link} href={paperUrl(pdf, snapshot.page)}>Open PDF page →</Link>
      <p className={styles.note}>This geometry comes from the canonical Evidence snapshot, not the mutable private annotation sidecar.</p>
    </section>
  );
}
