import type { ResearchOrchestrationIssue, ResearchOrchestrationStatus } from "./orchestration.mjs";

export type OrchestrationDraft = null | {
  status: Exclude<ResearchOrchestrationStatus, "untracked">;
  dependsOn: string[];
  next?: string;
  note?: string;
};

export type OrchestrationEditorProject = {
  id: string;
  label: string;
  description: string;
  notes: number;
  autoIndexed: boolean;
  configured: boolean;
  orchestration: null | {
    status: string;
    dependsOn: string[];
    next: string;
    note: string;
  };
};

export type OrchestrationPreview = {
  valid: boolean;
  issues: ResearchOrchestrationIssue[];
  changes: Array<{ field: string; before: string | string[]; after: string | string[] }>;
  orchestration: OrchestrationDraft;
  project: null | {
    id: string;
    label: string;
    status: ResearchOrchestrationStatus;
    dependencyState: "clear" | "waiting" | "invalid";
    waitingOn: Array<{ id: string; label: string; status: ResearchOrchestrationStatus | "missing" }>;
    dependencies: Array<{ id: string; label: string; status: ResearchOrchestrationStatus | "missing"; done: boolean }>;
  };
};

export function orchestrationConfigWritable(): boolean;
export function orchestrationConfigReason(): string;
export function readOrchestrationEditorState(options?: { rootDir?: string }): Promise<{
  enabled: boolean;
  reason: string;
  baseSha256: string;
  projects: OrchestrationEditorProject[];
}>;
export function previewOrchestrationConfig(options?: {
  rootDir?: string;
  projectId?: string;
  orchestration?: unknown;
  baseSha256?: string;
}): Promise<{ baseSha256: string; reviewSha256: string; preview: OrchestrationPreview }>;
export function saveOrchestrationConfig(options?: {
  rootDir?: string;
  projectId?: string;
  orchestration?: unknown;
  baseSha256?: string;
  reviewSha256?: string;
}): Promise<{ saved: true; baseSha256: string; preview: OrchestrationPreview }>;
