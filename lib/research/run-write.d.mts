export type RunWriteOptions = {
  rootDir?: string; projectId: string; experimentId: string; runId: string; label?: string; status?: "complete" | "running" | "failed" | "cancelled";
  parameters?: Record<string, unknown>; metrics?: Record<string, { value: number; source: Record<string, unknown> }>; notes?: string;
  upload?: { filename: string; bytes: Buffer };
};
export function createExperimentRun(options: RunWriteOptions): Promise<{ run: Record<string, unknown>; project: string; experimentId: string; manifestPath: string }>;
export function createExperimentRuns(options: Omit<RunWriteOptions, "runId" | "label" | "metrics" | "parameters" | "upload">, runs: Array<Omit<RunWriteOptions, "rootDir" | "projectId" | "experimentId">>): Promise<Array<{ run: Record<string, unknown>; project: string; experimentId: string; manifestPath: string }>>;
