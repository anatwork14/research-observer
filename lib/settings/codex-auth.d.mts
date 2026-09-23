export type CodexLoginStatus = {
  available: boolean;
  authenticated: boolean;
  mode?: string;
  reason?: string;
};

export type CodexAuthSession = {
  id: string;
  status: "starting" | "waiting" | "authenticated" | "error" | "cancelled";
  verificationUrl?: string;
  userCode?: string;
  error?: string;
  startedAt?: number;
};

export function codexLoginStatus(): Promise<CodexLoginStatus>;
export function currentCodexAuthSession(): CodexAuthSession | null;
export function startCodexDeviceAuth(): Promise<CodexAuthSession>;
export function cancelCodexDeviceAuth(): CodexAuthSession | null;
export function logoutCodex(): Promise<{ authenticated: false }>;
