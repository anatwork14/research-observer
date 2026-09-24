"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Project = { id: string; label: string };

export function WorkspaceProjectSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("research") ?? "";
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    let current = true;
    fetch("/api/research/projects", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Project list unavailable")))
      .then((payload: { projects?: Project[] }) => { if (current) setProjects(Array.isArray(payload.projects) ? payload.projects : []); })
      .catch(() => { if (current) setProjects([]); });
    return () => { current = false; };
  }, []);

  function changeProject(projectId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (projectId) params.set("research", projectId);
    else params.delete("research");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="project-context-selector">
      <span>Project</span>
      <select aria-label="Current research project" value={selectedId} onChange={(event) => changeProject(event.target.value)}>
        <option value="">All projects</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
      </select>
    </label>
  );
}
