export type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type ProposalMetadata = {
  id: string;
  kind?: "codex" | "direct-edit" | string;
  createdAt: string;
  files: string[];
  valid: boolean;
  reviewable: boolean;
  doctor: { code: number; output: string };
  summary: string;
  slug?: string;
  filename?: string;
  baseSha256?: string;
  workspaceSignature?: string;
  patchSha256: string;
};

export function runGit(cwd: string, args: string[], options?: { input?: string; timeoutMs?: number }): Promise<CommandResult>;
export function parseStatusPaths(output: string): string[];
export function allResearchPaths(paths: string[]): boolean;
export function gitStatusPaths(root: string): Promise<string[]>;
export function withDetachedWorktree<T>(root: string, task: (worktree: string) => Promise<T>): Promise<T>;
export function collectResearchDiff(worktree: string): Promise<{
  files: string[];
  patch: string;
  allowed: boolean;
  reviewable: boolean;
  patchBytes: number;
  binary: boolean;
}>;
export function runResearchDoctor(root: string, cwd?: string): Promise<CommandResult>;
export function storeProposal(root: string, proposal: {
  kind?: string;
  files: string[];
  patch: string;
  valid: boolean;
  reviewable: boolean;
  doctor: { code: number; output: string };
  summary: string;
  slug?: string;
  filename?: string;
  baseSha256?: string;
  workspaceSignature?: string;
}): Promise<ProposalMetadata>;
export function loadProposal(root: string, id: string): Promise<{ metadata: ProposalMetadata; patch: string }>;
export function deleteProposal(root: string, id: string): Promise<void>;
