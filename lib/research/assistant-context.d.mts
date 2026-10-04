import type { ResearchEvidenceSource } from "./compiler.mjs";

export type ResearchAssistantEntryRef = {
  slug: string;
  title: string;
  type?: string;
  status?: string;
  research: string;
  date?: string;
  summary: string;
};

export type ResearchAssistantRelationship = {
  type: string;
  note?: string;
  source?: ResearchAssistantEntryRef | null;
  target?: ResearchAssistantEntryRef | null;
};

export type ResearchAssistantEvidenceSignal = {
  type: string;
  source: ResearchAssistantEntryRef | null;
  target: ResearchAssistantEntryRef | null;
  sourceProvenance?: ResearchEvidenceSource;
  note?: string;
};

export type ResearchAssistantContext = {
  workspaceSignature: string;
  note: {
    slug: string;
    title: string;
    filename: string;
    research: string;
    type?: string;
    status?: string;
    date?: string;
    summary: string;
    tags: string[];
    contentChars: number;
    includedContentChars: number;
  };
  project: null | {
    id: string;
    label: string;
    description: string;
    notes: number;
    stats: {
      questions: number;
      hypotheses: number;
      experiments: number;
      results: number;
      evidence: number;
      decisions: number;
    };
    orchestration: null | {
      tracked: boolean;
      status: string;
      dependencyState: "clear" | "waiting" | "invalid";
      waitingOn: Array<{ id: string; label: string; status: string }>;
      dependencies: Array<{ id: string; label: string; status: string; done: boolean }>;
      next: string;
      note: string;
    };
  };
  relationships: {
    outgoing: ResearchAssistantRelationship[];
    incoming: ResearchAssistantRelationship[];
    references: ResearchAssistantEntryRef[];
    backlinks: ResearchAssistantEntryRef[];
  };
  evidence: {
    incomingSignals: ResearchAssistantEvidenceSignal[];
    outgoingSignals: ResearchAssistantEvidenceSignal[];
    counts: { supports: number; contradicts: number; answers: number };
  };
  health: {
    current: Array<{ code: string; label: string; description: string }>;
    project: Array<{ code: string; label: string; count: number; items: ResearchAssistantEntryRef[] }>;
  };
  recent: ResearchAssistantEntryRef[];
  suggestions: string[];
  literatureQueries: string[];
  summary: {
    explicitOutgoing: number;
    explicitIncoming: number;
    evidenceSignals: number;
    currentHealthConditions: number;
    projectHealthConditions: number;
  };
};

export function buildResearchAssistantContext(options?: {
  rootDir?: string;
  slug?: string;
}): Promise<{ context: ResearchAssistantContext; promptText: string }>;
