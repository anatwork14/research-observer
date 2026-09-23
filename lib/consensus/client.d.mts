export type ConsensusPaper = {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  journal: string;
  doi?: string;
  url: string;
  abstract?: string;
  takeaway?: string;
  studyType?: string;
  citationCount?: number;
  semanticScore?: number;
  fullTextChunks: Array<{ text: string; section?: string }>;
};

export type ConsensusSearchInput = {
  query: string;
  pageSize?: number;
  yearMin?: number;
  yearMax?: number;
  citationMin?: number;
  studyTypes?: string[];
  excludePreprints?: boolean;
  openAccess?: boolean;
  human?: boolean;
  medicalMode?: boolean;
  includeFullText?: boolean;
};

export type ConsensusClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  signal?: AbortSignal;
  rootDir?: string;
};

export function normalizeConsensusPaper(raw?: Record<string, unknown>): ConsensusPaper;
export function normalizeConsensusSearch(payload?: Record<string, unknown> | unknown[]): {
  query: string;
  totalResults: number;
  papers: ConsensusPaper[];
};
export function buildConsensusSearchParams(input?: ConsensusSearchInput): URLSearchParams;
export function searchConsensus(
  input?: ConsensusSearchInput,
  options?: ConsensusClientOptions,
): Promise<{ query: string; totalResults: number; papers: ConsensusPaper[] }>;
export function consensusConfigured(options?: { rootDir?: string }): Promise<boolean>;
export function consensusConfiguration(options?: { rootDir?: string }): Promise<{
  enabled: boolean;
  source: string;
  writable: boolean;
}>;
