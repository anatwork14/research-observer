const PROJECT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATUSES = new Set(["queued", "active", "blocked", "done"]);
const STATUS_ORDER = ["active", "queued", "blocked", "done", "untracked"];

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function projectConfigMap(workspace) {
  return new Map((workspace?.config?.researchProjects ?? []).map((project) => [project.id, project]));
}

function latestEntries(entries, projectId, limit = 3) {
  return entries
    .filter((entry) => (entry.research ?? "default") === projectId && entry.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.order - a.order || b.slug.localeCompare(a.slug))
    .slice(0, limit)
    .map((entry) => ({ slug: entry.slug, title: entry.title, date: entry.date, type: entry.type, status: entry.status }));
}

function normalizeProject(project, config, knownIds, issues) {
  const raw = config?.orchestration;
  if (raw === undefined) {
    return {
      ...project,
      tracked: false,
      orchestrationStatus: "untracked",
      dependsOn: [],
      next: "",
      note: "",
    };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    issues.push({
      severity: "error",
      code: "orchestration-invalid",
      project: project.id,
      message: `${project.label} orchestration must be an object.`,
    });
    return {
      ...project,
      tracked: false,
      orchestrationStatus: "untracked",
      dependsOn: [],
      next: "",
      note: "",
    };
  }

  const status = cleanText(raw.status);
  const validStatus = STATUSES.has(status);
  if (!validStatus) {
    issues.push({
      severity: "error",
      code: "orchestration-status-invalid",
      project: project.id,
      message: `${project.label} orchestration status must be queued, active, blocked, or done.`,
    });
  }

  let dependsOn = [];
  if (raw.dependsOn !== undefined) {
    if (!Array.isArray(raw.dependsOn) || raw.dependsOn.some((value) => typeof value !== "string")) {
      issues.push({
        severity: "error",
        code: "orchestration-dependencies-invalid",
        project: project.id,
        message: `${project.label} dependsOn must be a list of project IDs.`,
      });
    } else {
      dependsOn = [...new Set(raw.dependsOn.map((value) => value.trim()).filter(Boolean))];
    }
  }

  for (const dependency of dependsOn) {
    if (!PROJECT_ID.test(dependency)) {
      issues.push({
        severity: "error",
        code: "orchestration-dependency-id-invalid",
        project: project.id,
        dependency,
        message: `${project.label} depends on invalid project ID “${dependency}”.`,
      });
    } else if (dependency === project.id) {
      issues.push({
        severity: "error",
        code: "orchestration-self-dependency",
        project: project.id,
        dependency,
        message: `${project.label} cannot depend on itself.`,
      });
    } else if (!knownIds.has(dependency)) {
      issues.push({
        severity: "error",
        code: "orchestration-dependency-missing",
        project: project.id,
        dependency,
        message: `${project.label} depends on unknown project “${dependency}”.`,
      });
    }
  }

  const next = raw.next === undefined ? "" : cleanText(raw.next);
  const note = raw.note === undefined ? "" : cleanText(raw.note);
  if (raw.next !== undefined && typeof raw.next !== "string") {
    issues.push({ severity: "error", code: "orchestration-next-invalid", project: project.id, message: `${project.label} orchestration next must be text.` });
  }
  if (raw.note !== undefined && typeof raw.note !== "string") {
    issues.push({ severity: "error", code: "orchestration-note-invalid", project: project.id, message: `${project.label} orchestration note must be text.` });
  }

  return {
    ...project,
    tracked: validStatus,
    orchestrationStatus: validStatus ? status : "untracked",
    dependsOn,
    next,
    note,
  };
}

function findCycles(projects, knownIds, issues) {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const state = new Map();
  const stack = [];
  const cycleProjects = new Set();
  const seenCycles = new Set();

  function visit(id) {
    state.set(id, 1);
    stack.push(id);
    const project = byId.get(id);
    for (const dependency of project?.dependsOn ?? []) {
      if (!knownIds.has(dependency) || dependency === id || !byId.has(dependency)) continue;
      if (!state.has(dependency)) {
        visit(dependency);
        continue;
      }
      if (state.get(dependency) !== 1) continue;
      const start = stack.indexOf(dependency);
      const cycle = [...stack.slice(start), dependency];
      const members = [...new Set(cycle.slice(0, -1))].sort();
      const key = members.join("|");
      if (seenCycles.has(key)) continue;
      seenCycles.add(key);
      members.forEach((member) => cycleProjects.add(member));
      issues.push({
        severity: "error",
        code: "orchestration-cycle",
        projects: members,
        message: `Declared project dependency cycle: ${cycle.join(" → ")}.`,
      });
    }
    stack.pop();
    state.set(id, 2);
  }

  for (const project of projects) if (!state.has(project.id)) visit(project.id);
  return cycleProjects;
}

export function buildResearchOrchestration(workspace, selectedProjectIds = []) {
  const workspaceProjects = workspace?.projects ?? [];
  const knownIds = new Set(workspaceProjects.map((project) => project.id));
  const configById = projectConfigMap(workspace);
  const issues = [];
  const normalized = workspaceProjects.map((project) => normalizeProject(project, configById.get(project.id), knownIds, issues));
  const allById = new Map(normalized.map((project) => [project.id, project]));
  const cycleProjects = findCycles(normalized, knownIds, issues);
  const requested = [...new Set((selectedProjectIds ?? []).filter((id) => knownIds.has(id)))];
  const selected = requested.length ? new Set(requested) : knownIds;

  const projects = normalized
    .filter((project) => selected.has(project.id))
    .map((project) => {
      const dependencies = project.dependsOn.map((id) => {
        const target = allById.get(id);
        return target
          ? {
              id,
              label: target.label,
              status: target.orchestrationStatus,
              tracked: target.tracked,
              selected: selected.has(id),
              done: target.orchestrationStatus === "done",
            }
          : { id, label: id, status: "missing", tracked: false, selected: false, done: false };
      });
      const missingDependencies = dependencies.filter((dependency) => dependency.status === "missing");
      const waitingOn = dependencies.filter((dependency) => dependency.status !== "missing" && !dependency.done);
      const invalid = cycleProjects.has(project.id) || missingDependencies.length > 0 || project.dependsOn.includes(project.id);
      return {
        ...project,
        dependencies,
        waitingOn,
        missingDependencies,
        dependencyState: invalid ? "invalid" : waitingOn.length ? "waiting" : "clear",
        latestActivity: latestEntries(workspace?.entries ?? [], project.id),
      };
    });

  const edges = projects.flatMap((project) => project.dependencies.map((dependency) => ({
    source: project.id,
    sourceLabel: project.label,
    target: dependency.id,
    targetLabel: dependency.label,
    targetStatus: dependency.status,
    targetSelected: dependency.selected,
    done: dependency.done,
  })));

  const groups = Object.fromEntries(STATUS_ORDER.map((status) => [status, projects.filter((project) => project.orchestrationStatus === status)]));
  return {
    projects,
    edges,
    groups,
    issues,
    statusOrder: STATUS_ORDER,
    summary: {
      total: projects.length,
      tracked: projects.filter((project) => project.tracked).length,
      untracked: groups.untracked.length,
      active: groups.active.length,
      queued: groups.queued.length,
      blocked: groups.blocked.length,
      done: groups.done.length,
      waiting: projects.filter((project) => project.dependencyState === "waiting").length,
      invalid: projects.filter((project) => project.dependencyState === "invalid").length,
    },
  };
}
