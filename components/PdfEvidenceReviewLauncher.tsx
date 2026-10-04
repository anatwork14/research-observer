"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PdfAnnotationEvidenceReview } from "./PdfAnnotationEvidenceReview";
import styles from "./PdfEvidenceReviewLauncher.module.css";

type Annotation = {
  id: string;
  type: string;
  page: number;
  anchorKind: "text" | "region";
  quote: { exact: string };
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  anchorStatus?: "current" | "stale" | "legacy";
  sourceText?: { kind: string; text: string; reviewRequired: boolean } | null;
  updatedAt: string;
  deletedAt: string | null;
  evidence?: { slug: string; title: string; filename: string } | null;
};

type AnnotationState = {
  revision: number;
  annotations: Annotation[];
};

function reviewable(annotation: Annotation) {
  if (annotation.deletedAt || annotation.evidence || annotation.anchorStatus !== "current") return false;
  if (annotation.anchorKind === "text") return annotation.quote.exact.trim().length >= 3;
  return Boolean(annotation.sourceText?.text.trim() && !annotation.sourceText.reviewRequired);
}

export function PdfEvidenceReviewLauncher({ paperPath }: { paperPath: string }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<AnnotationState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/papers/annotations?paper=${encodeURIComponent(paperPath)}&includeDeleted=1`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load reviewable annotations.");
      setState({ revision: Number(payload.revision) || 0, annotations: Array.isArray(payload.annotations) ? payload.annotations : [] });
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load reviewable annotations.");
    }
  }, [paperPath]);

  useEffect(() => {
    let frame = 0;
    const findHost = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = document.querySelector<HTMLElement>('aside[aria-label="PDF annotations"]');
        setHost((current) => current === next ? current : next);
      });
    };
    findHost();
    const observer = new MutationObserver(findHost);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!host) return;
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 2500);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [host, load]);

  const candidates = useMemo(
    () => (state?.annotations ?? []).filter(reviewable).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state?.annotations],
  );
  const selected = candidates.find((annotation) => annotation.id === selectedId) ?? null;
  const activeSelectedId = selected?.id ?? null;

  if (!host) return null;

  return createPortal(
    <section className={styles.launcher} aria-label="Review PDF annotations as Evidence">
      <header className={styles.heading}>
        <div>
          <strong>Reviewable Evidence</strong>
          <small>{candidates.length} current annotation{candidates.length === 1 ? "" : "s"}</small>
        </div>
        <button type="button" onClick={() => void load()}>Refresh</button>
      </header>
      <p className={styles.boundary}>Promotion is review-first. Exact Markdown and the normalized page region must be inspected before Apply.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!candidates.length && !error && <p className={styles.empty}>No current reviewed annotation is ready for Evidence promotion.</p>}
      {candidates.length > 0 && (
        <div className={styles.candidates}>
          {candidates.map((annotation) => (
            <button
              key={annotation.id}
              type="button"
              data-active={activeSelectedId === annotation.id}
              onClick={() => setSelectedId((current) => current === annotation.id ? null : annotation.id)}
            >
              <strong>{annotation.type}</strong>
              <span>p.{annotation.page} · {annotation.anchorKind} · {annotation.rects.length} region{annotation.rects.length === 1 ? "" : "s"}</span>
            </button>
          ))}
        </div>
      )}
      {selected && state && (
        <PdfAnnotationEvidenceReview
          paperPath={paperPath}
          annotation={selected}
          revision={state.revision}
          onClose={() => setSelectedId(null)}
          onApplied={async () => {
            setSelectedId(null);
            await load();
          }}
        />
      )}
    </section>,
    host,
  );
}
