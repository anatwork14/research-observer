"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PdfEvidencePreview } from "@/lib/research/pdf-evidence-review.mjs";
import styles from "./PdfAnnotationEvidenceReview.module.css";

type Annotation = {
  id: string;
  type: string;
  page: number;
  anchorKind: "text" | "region";
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  updatedAt: string;
  sourceText?: { kind: string; text: string; reviewRequired: boolean } | null;
};

type SavedEvidence = { slug: string; filename: string; title: string; research: string };

export function PdfAnnotationEvidenceReview({
  paperPath,
  annotation,
  revision,
  onApplied,
  onClose,
}: {
  paperPath: string;
  annotation: Annotation;
  revision: number;
  onApplied: (result: SavedEvidence) => void | Promise<void>;
  onClose: () => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<{ key: string; preview: PdfEvidencePreview } | null>(null);
  const [saved, setSaved] = useState<SavedEvidence | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/papers/annotations/evidence", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        setEnabled(Boolean(payload.enabled));
        setReason(typeof payload.reason === "string" ? payload.reason : "");
      })
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") {
          setEnabled(false);
          setReason("PDF Evidence review availability could not be checked.");
        }
      });
    return () => controller.abort();
  }, []);

  const inputKey = useMemo(
    () => `${paperPath}:${annotation.id}:${annotation.updatedAt}:${revision}`,
    [annotation.id, annotation.updatedAt, paperPath, revision],
  );
  const preview = review?.key === inputKey ? review.preview : null;

  async function buildPreview() {
    if (previewing || applying) return;
    setPreviewing(true);
    setError("");
    setSaved(null);
    try {
      const response = await fetch("/api/papers/annotations/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", paperPath, id: annotation.id, expectedRevision: revision }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not build PDF Evidence review.");
      setReview({ key: inputKey, preview: payload.preview });
    } catch (requestError) {
      setReview(null);
      setError(requestError instanceof Error ? requestError.message : "Could not build PDF Evidence review.");
    } finally {
      setPreviewing(false);
    }
  }

  async function apply() {
    if (!preview || applying || !enabled) return;
    setApplying(true);
    setError("");
    try {
      const response = await fetch("/api/papers/annotations/evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          paperPath,
          id: annotation.id,
          expectedRevision: preview.annotationRevision,
          expectedWorkspaceSignature: preview.workspaceSignature,
          expectedDocumentSha256: preview.documentSha256,
          expectedProposalHash: preview.proposalHash,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409) setReview(null);
        throw new Error(payload.error || "Could not apply reviewed PDF Evidence.");
      }
      const result = payload.result as SavedEvidence;
      setSaved(result);
      await onApplied(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not apply reviewed PDF Evidence.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className={styles.review} aria-label="Review PDF annotation as Evidence">
      <header className={styles.header}>
        <div><span>Evidence review</span><strong>Freeze this PDF provenance</strong></div>
        <button type="button" onClick={onClose} disabled={applying} aria-label="Close Evidence review">×</button>
      </header>
      <p className={styles.boundary}>
        Review the exact Markdown and spatial snapshot before Apply. The saved Evidence owns this provenance; later sidecar edits do not rewrite it.
      </p>

      <div className={styles.provenanceGrid}>
        <div className={styles.pageMap} aria-label={`Normalized page ${annotation.page} region preview`}>
          {annotation.rects.map((rect, index) => (
            <span key={index} style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }} />
          ))}
        </div>
        <dl>
          <div><dt>Page</dt><dd>{annotation.page}</dd></div>
          <div><dt>Type</dt><dd>{annotation.type}</dd></div>
          <div><dt>Anchor</dt><dd>{annotation.anchorKind}</dd></div>
          <div><dt>Rects</dt><dd>{annotation.rects.length}</dd></div>
          {annotation.sourceText && <div><dt>Source text</dt><dd>{annotation.sourceText.kind}{annotation.sourceText.reviewRequired ? " · review required" : " · reviewed"}</dd></div>}
        </dl>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={() => void buildPreview()} disabled={previewing || applying}>
          {previewing ? "Building exact Evidence…" : preview ? "Rebuild preview" : "Review exact Evidence"}
        </button>
        {enabled === false && <small>{reason || "Apply is disabled; preview remains available."}</small>}
      </div>

      {preview && (
        <div className={styles.preview}>
          <div className={styles.snapshotMeta}>
            <span>{preview.project.label}</span>
            <span>PDF SHA {preview.documentSha256.slice(0, 12)}</span>
            <span>proposal {preview.proposalHash.slice(0, 12)}</span>
          </div>
          <details>
            <summary>Inspect exact Markdown + immutable spatial snapshot</summary>
            <code>{preview.file.filename}</code>
            <pre>{preview.file.content}</pre>
          </details>
          <p className={styles.integrity}>Apply rebuilds from the current annotation. Any annotation, PDF, workspace, or proposal change invalidates this review.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => void apply()} disabled={!enabled || applying || Boolean(saved)}>
              {applying ? "Applying reviewed Evidence…" : saved ? "Applied" : "Apply reviewed Evidence"}
            </button>
            <button type="button" onClick={() => setReview(null)} disabled={applying}>Discard preview</button>
          </div>
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
      {saved && <p className={styles.success} role="status">Spatial Evidence saved. <Link href={`/progress/${saved.slug}`}>Open Evidence →</Link></p>}
    </section>
  );
}
