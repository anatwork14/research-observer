"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrchestrationEditorProject, OrchestrationPreview } from "@/lib/research/orchestration-config.mjs";
import styles from "./ResearchOrchestrationEditor.module.css";

type EditorStatus = "untracked" | "queued" | "active" | "blocked" | "done";
type Draft = { status: EditorStatus; dependsOn: string[]; next: string; note: string };
type EditorState = {
  enabled: boolean;
  reason: string;
  baseSha256: string;
  projects: OrchestrationEditorProject[];
  error?: string;
};

type PreviewResponse = {
  baseSha256?: string;
  preview?: OrchestrationPreview;
  error?: string;
  issues?: Array<{ code?: string; message?: string }>;
};

const STATUS_OPTIONS: Array<{ value: EditorStatus; label: string; hint: string }> = [
  { value: "untracked", label: "Untracked", hint: "Remove explicit orchestration metadata." },
  { value: "queued", label: "Queued", hint: "Planned but not currently active." },
  { value: "active", label: "Active", hint: "Explicitly being worked on now." },
  { value: "blocked", label: "Blocked", hint: "Explicitly blocked; dependencies do not set this automatically." },
  { value: "done", label: "Done", hint: "Explicitly completed for coordination purposes." },
];

function draftFor(project: OrchestrationEditorProject): Draft {
  const current = project.orchestration;
  const status = current && ["queued", "active", "blocked", "done"].includes(current.status)
    ? current.status as Exclude<EditorStatus, "untracked">
    : "untracked";
  return {
    status,
    dependsOn: current?.dependsOn ?? [],
    next: current?.next ?? "",
    note: current?.note ?? "",
  };
}

function displayValue(value: string | string[]) {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  return value || "None";
}

export function ResearchOrchestrationEditor({ projectId, projectLabel }: { projectId: string; projectLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<EditorState | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<OrchestrationPreview | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState("");
  const [error, setError] = useState("");

  const fingerprint = useMemo(() => JSON.stringify({ projectId, draft }), [projectId, draft]);
  const currentProject = state?.projects.find((project) => project.id === projectId);
  const dependencyProjects = state?.projects.filter((project) => project.id !== projectId) ?? [];
  const reviewed = Boolean(preview && preview.valid && previewFingerprint === fingerprint);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy]);

  function mutate(next: Draft) {
    setDraft(next);
    setPreview(null);
    setPreviewFingerprint("");
    setError("");
  }

  async function loadEditor() {
    setOpen(true);
    setLoading(true);
    setError("");
    setPreview(null);
    setPreviewFingerprint("");
    try {
      const response = await fetch("/api/research/orchestration", { cache: "no-store" });
      const data = await response.json() as EditorState;
      if (!response.ok || data.error) throw new Error(data.error || "Could not load orchestration configuration.");
      setState(data);
      const project = data.projects.find((item) => item.id === projectId);
      if (!project) throw new Error("This research project is no longer available.");
      setDraft(draftFor(project));
    } catch (cause) {
      setState(null);
      setDraft(null);
      setError(cause instanceof Error ? cause.message : "Could not load orchestration configuration.");
    } finally {
      setLoading(false);
    }
  }

  function requestPayload() {
    if (!draft) return null;
    if (draft.status === "untracked") return null;
    return {
      status: draft.status,
      dependsOn: draft.dependsOn,
      next: draft.next,
      note: draft.note,
    };
  }

  async function runAction(action: "preview" | "save") {
    if (!state || !draft || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/research/orchestration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          projectId,
          baseSha256: state.baseSha256,
          orchestration: requestPayload(),
        }),
      });
      const data = await response.json() as PreviewResponse;
      if (!response.ok || data.error) {
        const issueText = data.issues?.map((issue) => issue.message || issue.code).filter(Boolean).join(" ");
        throw new Error([data.error || "Orchestration edit failed.", issueText].filter(Boolean).join(" "));
      }
      if (!data.preview) throw new Error("The orchestration service returned no review result.");
      if (action === "preview") {
        setPreview(data.preview);
        setPreviewFingerprint(fingerprint);
        return;
      }
      setPreview(data.preview);
      if (data.baseSha256) setState((current) => current ? { ...current, baseSha256: data.baseSha256 } : current);
      router.refresh();
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Orchestration edit failed.");
      if (action === "save") {
        setPreview(null);
        setPreviewFingerprint("");
      }
    } finally {
      setBusy(false);
    }
  }

  function toggleDependency(id: string) {
    if (!draft) return;
    const selected = draft.dependsOn.includes(id);
    mutate({
      ...draft,
      dependsOn: selected ? draft.dependsOn.filter((item) => item !== id) : [...draft.dependsOn, id],
    });
  }

  return (
    <>
      <button type="button" className={styles.launcher} onClick={loadEditor}>Edit coordination</button>
      {open && (
        <div className={styles.backdrop} role="presentation">
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={`orchestration-editor-${projectId}`}>
            <header className={styles.header}>
              <div>
                <span>Local orchestration editor</span>
                <h3 id={`orchestration-editor-${projectId}`}>{projectLabel}</h3>
                <p>Preview validates the exact draft. Save writes only after that same draft has passed review.</p>
              </div>
              <button type="button" className={styles.close} onClick={() => !busy && setOpen(false)} disabled={busy} aria-label="Close orchestration editor">×</button>
            </header>

            {loading && <p className={styles.stateMessage}>Loading current config…</p>}
            {!loading && error && <div className={styles.error} role="alert">{error}</div>}

            {!loading && state && !state.enabled && (
              <div className={styles.disabled}>
                <strong>Editing is read-only in this environment.</strong>
                <p>{state.reason}</p>
              </div>
            )}

            {!loading && state?.enabled && currentProject && draft && (
              <div className={styles.body}>
                <div className={styles.projectMeta}>
                  <span>{currentProject.autoIndexed ? "Folder-indexed" : currentProject.configured ? "Configured" : "Discovered"}</span>
                  <b>{currentProject.notes} objects</b>
                  <code>{projectId}</code>
                </div>

                <fieldset className={styles.statusFieldset} disabled={busy}>
                  <legend>Declared status</legend>
                  <div className={styles.statusGrid}>
                    {STATUS_OPTIONS.map((option) => (
                      <label key={option.value} data-selected={draft.status === option.value || undefined}>
                        <input
                          type="radio"
                          name={`orchestration-status-${projectId}`}
                          value={option.value}
                          checked={draft.status === option.value}
                          onChange={() => mutate({ ...draft, status: option.value })}
                        />
                        <span><strong>{option.label}</strong><small>{option.hint}</small></span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {draft.status !== "untracked" && (
                  <>
                    <fieldset className={styles.dependencies} disabled={busy}>
                      <legend>Depends on</legend>
                      <p>Dependencies are explicit and directional. They provide waiting context but never rewrite the declared status.</p>
                      <div className={styles.dependencyList}>
                        {dependencyProjects.map((project) => (
                          <label key={project.id} data-selected={draft.dependsOn.includes(project.id) || undefined}>
                            <input
                              type="checkbox"
                              checked={draft.dependsOn.includes(project.id)}
                              onChange={() => toggleDependency(project.id)}
                            />
                            <span><strong>{project.label}</strong><small>{project.id} · {project.notes} objects</small></span>
                          </label>
                        ))}
                        {!dependencyProjects.length && <p className={styles.quiet}>No other research projects are available.</p>}
                      </div>
                    </fieldset>

                    <label className={styles.textField}>
                      <span>Next declared step <small>{draft.next.length}/800</small></span>
                      <textarea
                        value={draft.next}
                        maxLength={800}
                        rows={3}
                        disabled={busy}
                        placeholder="What is the next explicit action for this research stream?"
                        onChange={(event) => mutate({ ...draft, next: event.target.value })}
                      />
                    </label>

                    <label className={styles.textField}>
                      <span>Coordination note <small>{draft.note.length}/1600</small></span>
                      <textarea
                        value={draft.note}
                        maxLength={1600}
                        rows={4}
                        disabled={busy}
                        placeholder="Optional context for coordinating this stream."
                        onChange={(event) => mutate({ ...draft, note: event.target.value })}
                      />
                    </label>
                  </>
                )}

                {draft.status === "untracked" && (
                  <div className={styles.untrackedNotice}>
                    Saving this reviewed change removes only the project&apos;s <code>orchestration</code> metadata. Project identity, notes, folders, experiments, and research content remain unchanged.
                  </div>
                )}

                {preview && previewFingerprint === fingerprint && (
                  <section className={styles.preview} aria-label="Orchestration change preview">
                    <header>
                      <div><span>Review</span><h4>{preview.valid ? "Ready to save" : "Validation issues"}</h4></div>
                      {preview.project && <b data-state={preview.project.dependencyState}>{preview.project.status} · {preview.project.dependencyState}</b>}
                    </header>
                    <div className={styles.changeList}>
                      {preview.changes.map((change) => (
                        <article key={change.field}>
                          <strong>{change.field}</strong>
                          <div><span>{displayValue(change.before)}</span><i>→</i><span>{displayValue(change.after)}</span></div>
                        </article>
                      ))}
                    </div>
                    {preview.project?.waitingOn.length ? (
                      <p className={styles.waiting}>Waiting context: {preview.project.waitingOn.map((item) => `${item.label} (${item.status})`).join(", ")}.</p>
                    ) : null}
                    {preview.issues.length > 0 && (
                      <div className={styles.issueList}>
                        {preview.issues.map((issue, index) => <p key={`${issue.code}-${index}`}><code>{issue.code}</code> {issue.message}</p>)}
                      </div>
                    )}
                  </section>
                )}

                <footer className={styles.footer}>
                  <button type="button" className={styles.secondary} disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
                  <button type="button" className={styles.previewButton} disabled={busy} onClick={() => runAction("preview")}>{busy ? "Checking…" : "Preview changes"}</button>
                  <button type="button" className={styles.saveButton} disabled={busy || !reviewed} onClick={() => runAction("save")}>{busy ? "Saving…" : "Save reviewed change"}</button>
                </footer>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
