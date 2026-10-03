"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  parseResearchProjectScope,
  primaryResearchProject,
  serializeResearchProjectScope,
  toggleResearchProjectScope,
} from "@/lib/research/workspace-project-scope.mjs";
import styles from "./WorkspaceProjectSelector.module.css";

type Project = { id: string; label: string };

export function WorkspaceProjectSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const multiScope = pathname === "/insights" || pathname.startsWith("/insights/");
  const availableIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const rawScope = searchParams.getAll("research");
  const selectedIds = parseResearchProjectScope(rawScope, { availableIds });
  const selectedId = primaryResearchProject(rawScope, { availableIds });
  const selectedSet = new Set(selectedIds);

  useEffect(() => {
    let current = true;
    fetch("/api/research/projects", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Project list unavailable")))
      .then((payload: { projects?: Project[] }) => { if (current) setProjects(Array.isArray(payload.projects) ? payload.projects : []); })
      .catch(() => { if (current) setProjects([]); });
    return () => { current = false; };
  }, []);

  function navigateWithScope(ids: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("research");
    const scope = serializeResearchProjectScope(ids);
    if (scope) params.set("research", scope);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function changeProject(projectId: string) {
    navigateWithScope(projectId ? [projectId] : []);
  }

  function toggleProject(projectId: string) {
    navigateWithScope(toggleResearchProjectScope(rawScope, projectId, { availableIds }));
  }

  if (multiScope) {
    const explicitScope = selectedIds.length > 0;
    const summary = !explicitScope
      ? "All projects"
      : selectedIds.length === 1
        ? projects.find((project) => project.id === selectedIds[0])?.label || selectedIds[0]
        : `${selectedIds.length} projects`;

    return (
      <details className={styles.multiSelector}>
        <summary className={styles.summary} aria-label={`Research project scope: ${summary}`}>
          <span>{summary}</span>
          <small>{explicitScope ? `${selectedIds.length}/${projects.length || selectedIds.length}` : "portfolio"}</small>
        </summary>
        <div className={styles.menu} role="group" aria-label="Research project scope">
          <div className={styles.menuHeading}>
            <div><strong>Research scope</strong><small>Keep several research tracks active together.</small></div>
            <button className={!explicitScope ? styles.activeButton : styles.scopeButton} type="button" onClick={() => navigateWithScope([])} aria-pressed={!explicitScope}>All projects</button>
          </div>
          <div className={styles.projectList}>
            {projects.map((project) => {
              const active = explicitScope && selectedSet.has(project.id);
              return (
                <button
                  className={active ? styles.activeProject : styles.projectButton}
                  type="button"
                  onClick={() => toggleProject(project.id)}
                  aria-pressed={active}
                  key={project.id}
                >
                  <span>{project.label}</span>
                  <small>{active ? "Included" : explicitScope ? "Add" : "Focus only"}</small>
                </button>
              );
            })}
            {!projects.length && <span className={styles.empty}>No indexed projects available.</span>}
          </div>
          <p className={styles.note}>This multi-project scope is used by Insights. Opening a single-project workspace from the top navigation uses the first selected project deterministically.</p>
        </div>
      </details>
    );
  }

  return (
    <label className="project-context-selector">
      <span className="sr-only">Current project</span>
      <select aria-label="Current research project" value={selectedId} onChange={(event) => changeProject(event.target.value)}>
        <option value="">All projects</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
      </select>
    </label>
  );
}
