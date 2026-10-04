"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReviewedEvidencePreview } from "@/lib/research/reviewed-evidence.mjs";
import styles from "./ConsensusEvidenceReview.module.css";

type Paper = {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  journal: string;
  doi?: string;
  url: string;
  abstract?: string;
  takeaway?: string;
  studyType?: string;
  citationCount?: number;
  fullTextChunks: Array<{ text: string; section?: string }>;
};

type TargetNote = { slug: string; title: string; type?: string; research?: string };
type SavedEvidence = { slug: string; filename: string; title?: string; research?: string };

export function ConsensusEvidenceReview({
  paper,
  query,
  researchId,
  targetNote,
  onSaved,
}: {
  paper: Paper;
  query: string;
  researchId?: string;
  targetNote?: TargetNote;
  onSaved?: (result: SavedEvidence) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [relationType, setRelationType] = useState("");
  const [comment, setComment] = useState("");
  const [review, setReview] = useState<{ key: string; preview: ReviewedEvidencePreview } | null>(null);
  const [saved, setSaved] = useState<{ key: string; result: SavedEvidence } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/evidence/review", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload) => {
        setEnabled(Boolean(payload.enabled));
        setReason(typeof payload.reason === "string" ? payload.reason : "");
      })
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") {
          setEnabled(false);
          setReason("Reviewed Evidence availability could not be checked.");
        }
      });
    return () => controller.abort();
  }, []);

  const inputKey = useMemo(() => JSON.stringify({
    source: paper.id || paper.doi || paper.url || paper.title,
    query,
    researchId: researchId || "",
    targetSlug: targetNote?.slug || "",
    relationType,
    comment,
  }), [paper.id, paper.doi, paper.url, paper.title, query, researchId, targetNote?.slug, relationType, comment]);

  const activePreview = review?.key === inputKey ? review.preview : null;
  const activeSaved = saved?.key === inputKey ? saved.result : null;
  const canRelate = Boolean(targetNote?.slug);

  async function preview() {
    if (previewing || applying) return;
    setPreviewing(true);
    setError("");
    try {
      const response = await fetch("/api/evidence/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview",
          paper,
          query,
          research: researchId,
          targetSlug: targetNote?.slug,
          relationType,
          comment,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not build the Evidence review.");
      setReview({ key: inputKey, preview: payload.preview });
      setSaved(null);
    } catch (requestError) {
      setReview(null);
      setError(requestError instanceof Error ? requestError.message : "Could not build the Evidence review.");
    } finally {
      setPreviewing(false);
    }
  }

  async function apply() {
    if (!activePreview || applying || !enabled) return;
    setApplying(true);
    setError("");
    try {
      const response = await fetch("/api/evidence/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          paper,
          query,
          research: researchId,
          targetSlug: targetNote?.slug,
          relationType,
          comment,
          expectedWorkspaceSignature: activePreview.workspaceSignature,
          expectedProposalHash: activePreview.proposalHash,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409) setReview(null);
        throw new Error(payload.error || "Could not apply the reviewed Evidence proposal.");
      }
      const result = payload.result as SavedEvidence;
      setSaved({ key: inputKey, result });
      onSaved?.(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not apply the reviewed Evidence proposal.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section className={styles.review} aria-label={`Review Evidence from ${paper.title}`}>
      <header className={styles.header}>
        <div>
          <span>Evidence review</span>
          <strong>Choose semantics explicitly</strong>
        </div>
        <small>{enabled === null ? "checking writes" : enabled ? "apply enabled" : "preview only"}</small>
      </header>

      <p className={styles.boundary}>
        Saving the paper creates a canonical Evidence object. A semantic edge is added only if you explicitly choose one below; Consensus ranking and summaries never choose it for you.
      </p>

      {targetNote ? (
        <div className={styles.target}>
          <span>Current target</span>
          <strong>{targetNote.title}</strong>
          <small>{targetNote.type || "note"} · {targetNote.slug}</small>
        </div>
      ) : (
        <div className={styles.target}><span>No current note target</span><small>Evidence can still be saved without a semantic relationship.</small></div>
      )}

      <label className={styles.field}>
        <span>Relationship to current note</span>
        <select value={relationType} onChange={(event) => setRelationType(event.target.value)} disabled={!canRelate}>
          <option value="">No semantic relationship</option>
          <option value="supports">supports</option>
          <option value="contradicts">contradicts</option>
          {targetNote?.type === "question" && <option value="answers">answers</option>}
        </select>
        <small>{canRelate ? "This is an authored Evidence → note relationship." : "Open Research Assist from a note to author a relationship."}</small>
      </label>

      <label className={styles.field}>
        <span>Research note <small>optional</small></span>
        <textarea rows={3} maxLength={12000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Why are you preserving this paper as Evidence?" />
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => void preview()} disabled={previewing || applying}>
          {previewing ? "Building exact Evidence…" : activePreview ? "Rebuild review" : "Review exact Evidence"}
        </button>
        {!enabled && reason && <small>{reason}</small>}
      </div>

      {activePreview && (
        <div className={styles.preview}>
          <div className={styles.summary}>
            <span>{activePreview.source.hasFullTextExcerpt ? "Eligible full-text excerpt" : "Discovery context only"}</span>
            <span>{activePreview.relationship ? `${activePreview.relationship.type} → ${activePreview.target?.title}` : "No semantic edge"}</span>
            <span>{activePreview.project.label}</span>
          </div>
          <details>
            <summary>Inspect exact Markdown before Apply</summary>
            <div className={styles.fileMeta}>
              <code>{activePreview.file.filename}</code>
              <small>proposal {activePreview.proposalHash.slice(0, 12)}</small>
            </div>
            <pre>{activePreview.file.content}</pre>
          </details>
          <p className={styles.integrity}>Apply rebuilds this proposal on the server. Workspace or review changes invalidate the proposal and require another preview.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => void apply()} disabled={!enabled || applying || Boolean(activeSaved)}>
              {applying ? "Applying reviewed Evidence…" : activeSaved ? "Applied" : "Apply reviewed Evidence"}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setReview(null)} disabled={applying}>Discard review</button>
          </div>
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
      {activeSaved && (
        <p className={styles.success} role="status">
          Reviewed Evidence saved. <Link href={`/progress/${activeSaved.slug}`}>Open Evidence →</Link>
        </p>
      )}
    </section>
  );
}
