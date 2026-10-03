export type LocalHealthState = "ready" | "attention" | "unavailable";

export type LocalHealthCheck = {
  id: string;
  group: string;
  title: string;
  state: LocalHealthState;
  detail: string;
  meta?: string;
  repair?: "rebuild-research" | "prepare-pdf-runtime";
};

export type LocalWorkspaceHealth = {
  generatedAt: string;
  maintenanceEnabled: boolean;
  summary: {
    ready: number;
    attention: number;
    unavailable: number;
    overall: "ready" | "partial" | "attention";
  };
  paths: {
    progress: string;
    annotations: string;
    manuscripts: string;
    generated: string;
    pdfRuntime: string;
    codexHome?: string;
  };
  checks: LocalHealthCheck[];
};

export function resolveLocalWorkspacePaths(root?: string, config?: Record<string, unknown>): {
  progress: { path: string; valid: boolean; configured: string };
  annotations: { path: string; valid: boolean; configured: string };
  manuscripts: { path: string; valid: boolean; configured: string };
  generated: { path: string; valid: boolean; configured: string };
  pdfRuntime: { path: string; valid: boolean; configured: string };
  codexHome: { path: string; valid: boolean; configured: string } | null;
};

export function classifyNodeRuntime(version?: string): { state: "ready" | "attention"; detail: string };
export function localMaintenanceEnabled(env?: NodeJS.ProcessEnv, nodeEnv?: string): boolean;
export function summarizeLocalHealth(checks?: Array<{ state?: string }>): {
  ready: number;
  attention: number;
  unavailable: number;
  overall: "ready" | "partial" | "attention";
};
export function collectLocalWorkspaceHealth(options?: { root?: string }): Promise<LocalWorkspaceHealth>;
export function repairLocalWorkspace(action: string): Promise<LocalWorkspaceHealth>;
