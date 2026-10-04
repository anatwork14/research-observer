"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NewResearchPlan, ResearchScaffoldPreview } from "@/lib/research/new-research-scaffold.mjs";
import styles from "./NewResearchScaffold.module.css";

type ProjectOption = {
  id: string;
  label: string;
  description?: string;
  directory?: string;
  notes: number;
};

type ScaffoldResult = {
  project: { id: string; label: string; directory: string; created: boolean };
  notes: Array<{ slug: string; filename: string; title: string; type?: string; research: string }>;
  workspaceSignature: string;
};

export function NewResearchScaffold({
  topic,
  objective,
  plan,
}: {
  topic: string;
  objective: string;
  plan: NewResearchPlan;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [projectId, setProjectId] = useState("");
  const [projectLabel, setProjectLabel] = useState(topic.slice(0, 120));
  const [projectDescription, setProjectDescription] = useState(objective.slice(0, 800));
  const [preview, setPreview] = useState<ResearchScaffoldPreview | null>(null);
  const [result, setResult] = useState<ScaffoldResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/research/new/scaffold", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load scaffold targets.");
        return payload;
      })
      .then((payload) => {
        const nextProjects = Array.isArray(payload.projects) ? payload.projects : [];
        setEnabled(Boolean(payload.enabled));
        setProjects(nextProjects);
        setProjectId((current) => current || nextProjects[0]?.id || "");
      })
      .catch((reason) => {
        if ((reason as Error).name !== "AbortError") {
          setEnabled(false);
          setError(reason instanceof Error ? reason.message : "Could not load scaffold targets.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setPreview(null);
    setResult(null);
    setError("");
  }, [topic, objective, plan, mode, projectId, projectLabel, projectDescription]);

  const target = useMemo(() => mode === "existing"
    ? { mode: "existing" as const, projectId }
    : { mode: "new" as const, projectLabel, projectDescription },
  [mode, projectId, projectLabel, projectDescription]);

  const canPreview = Boolean(topic.trim()) && (mode === "existing" ? Boolean(projectId) : Boolean(projectLabel.trim()));

  async function buildPreview() {
    if (!canPreview || previewing || applying) return;
    setPreviewing(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/research/new/scaffold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", topic, objective, plan, target }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not build the scaffold preview.");
      setPreview(payload.preview ?? null);
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : "Could not build the scaffold preview.");
    } finally {
      setPreviewing(false);
    }
  }

  async function apply() {
    if (!preview || applying || !enabled) return;
    setApplying(true);
    setError("");
    try {
      const response = await fetch("/api/research/new/scaffold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          topic,
          objective,
          plan,
          target,
          expectedWorkspaceSignature: preview.workspaceSignature,
          expectedProposalHash: preview.proposalHash,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409) setPreview(null);
        throw new Error(payload.error || "Could not apply the reviewed scaffold.");
      }
      setResult(payload.result ?? null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not apply the reviewed scaffold.");
    } finally {
      setApplying(false);
    }
  }

  if (loading) return <div className={styles.state}>Loading workspace targets for the reviewed research plan…</div>;

  return (
    <div className={styles.stage}>
      <div className={styles.boundary}>
        <strong>Review-first workspace scaffold</strong>
        <p>
          This step converts the plan you already reviewed into ordinary Markdown research objects. It does not create Evidence objects or support/contradiction/answer relationships from Consensus results.
        </p>
      </div>

      <div className={styles.modeGrid} role="group" aria-label="Scaffold target mode">
        <button type="button" className={styles.modeButton} data-active={mode === "new"} onClick={() => setMode("new")}>
          <strong>New project</strong>
          <small>Create a folder-backed research project with a stable manifest.</small>
        </button>
        <button type="button" className={styles.modeButton} data-active={mode === "existing"} onClick={() => setMode("existing")} disabled={!projects.length}>
          <strong>Existing project</strong>
          <small>Append the scaffold after the project&apos;s current ordered notes.</small>
        </button>
      </div>

      {mode === "new" ? (
        <div className={styles.targetCard}>
          <strong>New folder-backed project</strong>
          <label className={styles.field}>
            <span>Project name</span>
            <input value={projectLabel} maxLength={120} onChange={(event) => setProjectLabel(event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Description <small>optional</small></span>
            <textarea value={projectDescription} maxLength={800} onChange={(event) => setProjectDescription(event.target.value)} />
          </label>
          <p>The server derives a safe folder and stable project ID. Existing folders or colliding IDs are rejected.</p>
        </div>
      ) : (
        <div className={styles.targetCard}>
          <strong>Existing research project</strong>
          <label className={styles.field}>
            <span>Project</span>
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.label} · {project.notes} note{project.notes === 1 ? "" : "s"}</option>
              ))}
            </select>
          </label>
          {projects.find((project) => project.id === projectId)?.description && (
            <p>{projects.find((project) => project.id === projectId)?.description}</p>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => void buildPreview()} disabled={!canPreview || previewing || applying}>
          {previewing ? "Building exact Markdown…" : preview ? "Rebuild preview" : "Build exact preview"}
        </button>
        {!enabled && <span className={styles.state}>Apply is disabled in this environment. Preview remains available.</span>}
      </div>

      {preview && (
        <section className={styles.preview} aria-label="Research scaffold preview">
          <header className={styles.previewHeader}>
            <div>
              <strong>Exact files to create</strong>
              <p>{preview.target.projectLabel} · proposal {preview.proposalHash.slice(0, 12)}</p>
            </div>
            <div className={styles.summary}>
              <span>{preview.summary.notes} Markdown notes</span>
              <span>{preview.summary.hypotheses} hypotheses</span>
              <span>{preview.summary.experiments} experiments</span>
              <span data-safe="true">0 Evidence objects</span>
              <span data-safe="true">0 semantic Evidence edges</span>
            </div>
          </header>

          <div className={styles.fileList}>
            {preview.manifest && (
              <details className={styles.file}>
                <summary>
                  <span className={styles.fileHeading}>
                    <strong>Project manifest</strong>
                    <code>{preview.manifest.filename}</code>
                  </span>
                </summary>
                <pre className={styles.source}>{preview.manifest.content}</pre>
              </details>
            )}
            {preview.files.map((file) => (
              <details className={styles.file} key={file.filename}>
                <summary>
                  <span className={styles.fileHeading}>
                    <strong>{file.title}</strong>
                    <small>{file.type} · {file.kind}</small>
                    <code>{file.filename}</code>
                    {file.relationships.length > 0 && (
                      <span className={styles.relations}>
                        {file.relationships.map((relation) => <code key={`${relation.type}-${relation.target}`}>{relation.type} → {relation.target}</code>)}
                      </span>
                    )}
                  </span>
                </summary>
                <pre className={styles.source}>{file.content}</pre>
              </details>
            ))}
          </div>

          <p className={styles.integrity}>
            Apply writes only the exact proposal rebuilt by the server. If the workspace or proposal changes after this preview, Apply fails stale and requires a fresh review.
          </p>

          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => void apply()} disabled={!enabled || applying || Boolean(result)}>
              {applying ? "Applying reviewed scaffold…" : result ? "Applied" : "Apply reviewed scaffold"}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setPreview(null)} disabled={applying}>Discard preview</button>
          </div>
        </section>
      )}

      {error && <div className={styles.error} role="alert">{error}</div>}

      {result && (
        <section className={styles.success} role="status">
          <strong>{result.project.created ? "Research project created" : "Research scaffold added"}</strong>
          <p>{result.notes.length} reviewed Markdown objects were compiled successfully under {result.project.label}.</p>
          <div className={styles.createdLinks}>
            {result.notes.map((note) => (
              <Link key={note.slug} href={`/progress/${note.slug}`}>{note.type ?? "note"}: {note.title} →</Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
