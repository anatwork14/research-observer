export type ConsensusIntegrationStatus = {
  configured: boolean;
  source: "explicit" | "environment" | "workspace-settings" | "none" | string;
  writable: boolean;
};

export function integrationSettingsWritable(): boolean;
export function readIntegrationSettings(options?: { rootDir?: string }): Promise<{ consensusApiKey?: string }>;
export function saveConsensusApiKey(apiKey: string, options?: { rootDir?: string }): Promise<{ configured: true; source: "workspace-settings" }>;
export function clearConsensusApiKey(options?: { rootDir?: string }): Promise<{ configured: boolean; source: string }>;
export function resolveConsensusApiKey(options?: { rootDir?: string; explicit?: string }): Promise<{ apiKey: string; source: string }>;
export function consensusIntegrationStatus(options?: { rootDir?: string }): Promise<ConsensusIntegrationStatus>;
