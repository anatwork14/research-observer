import type { ResearchEntry, ResearchProjectSummary, ResearchWorkspace } from "./compiler.mjs";

export type ResearchOrchestrationStatus = "queued" | "active" | "blocked" | "done" | "untracked";
export type ResearchDependencyState = "clear" | "waiting" | "invalid";

export type ResearchOrchestrationDependency = {
  id: string;
  label: string;
  status: ResearchOrchestrationStatus | "missing";
  tracked: boolean;
  selected: boolean;
  done: boolean;
};

export type ResearchOrchestrationProject = ResearchProjectSummary & {
  tracked: boolean;
  orchestrationStatus: ResearchOrchestrationStatus;
  dependsOn: string[];
  next: string;
  note: string;
  dependencies: ResearchOrchestrationDependency[];
  waitingOn: ResearchOrchestrationDependency[];
  missingDependencies: ResearchOrchestrationDependency[];
  dependencyState: ResearchDependencyState;
  latestActivity: Array<Pick<ResearchEntry, "slug" | "title" | "date" | "type" | "status">>;
};

export type ResearchOrchestrationIssue = {
  severity: "error";
  code: string;
  project?: string;
  dependency?: string;
  projects?: string[];
  message: string;
};

export type ResearchOrchestration = {
  projects: ResearchOrchestrationProject[];
  edges: Array<{
    source: string;
    sourceLabel: string;
    target: string;
    targetLabel: string;
    targetStatus: ResearchOrchestrationStatus | "missing";
    targetSelected: boolean;
    done: boolean;
  }>;
  groups: Record<ResearchOrchestrationStatus, ResearchOrchestrationProject[]>;
  issues: ResearchOrchestrationIssue[];
  statusOrder: ResearchOrchestrationStatus[];
  summary: {
    total: number;
    tracked: number;
    untracked: number;
    active: number;
    queued: number;
    blocked: number;
    done: number;
    waiting: number;
    invalid: number;
  };
};

export function buildResearchOrchestration(workspace: ResearchWorkspace, selectedProjectIds?: string[]): ResearchOrchestration;
