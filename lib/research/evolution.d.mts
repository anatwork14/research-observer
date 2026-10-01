import type { ResearchWorkspace } from "./compiler.mjs";
import type { LatexCitationReference } from "./latex-citations.mjs";

export type EvolutionNode = {
  id: string;
  kind: "research" | "paper" | "annotation" | "manuscript" | "passage" | "claim" | "citation" | "revision";
  label: string;
  research: string;
  role?: string;
  href?: string;
  slug?: string;
  type?: string;
  status?: string;
  date?: string;
  order?: number;
  pdf?: string;
  sourceKind?: "pdf" | "consensus";
  doi?: string;
  url?: string;
  paperId?: string;
  annotationId?: string;
  annotationType?: string;
  anchorKind?: string;
  sourceTextKind?: string;
  page?: number;
  file?: string;
  main?: boolean;
  key?: string;
  claimId?: string;
  anchorLine?: number;
  start?: number;
  end?: number;
  line?: number;
  lineEnd?: number;
  column?: number;
  section?: string;
  sectionLevel?: string;
  excerpt?: string;
  choices?: string[];
  commit?: string;
  shortCommit?: string;
  author?: string;
  added?: number;
  removed?: number;
  files?: string[];
  stateChanged?: boolean;
};

export type EvolutionEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  layer: "semantic" | "reference" | "source" | "version" | "citation" | "claim" | "claim-evidence";
  explicit: boolean;
};

export type EvolutionTimelineEvent = {
  id: string;
  at: string;
  kind: "research" | "run" | "manuscript";
  nodeId?: string;
  label: string;
  research: string;
  type?: string;
  status?: string;
  experimentSlug?: string;
  runId?: string;
  commit?: string;
};

export type EvolutionLineage = {
  id: string;
  members: string[];
  newest: string[];
  oldest: string[];
  cyclic: boolean;
};

export type ManuscriptCitationProjection = {
  projectId: string;
  nodes: EvolutionNode[];
  edges: EvolutionEdge[];
  unresolved: Array<{
    file: string;
    key: string;
    status: string;
    choices: string[];
    start: number;
    line?: number;
    section?: string;
  }>;
  stats: {
    manuscriptFiles: number;
    passages: number;
    citations: number;
    resolved: number;
    ambiguous: number;
    missing: number;
  };
};

export type ResearchEvolutionProjection = {
  projectId: string | null;
  nodes: EvolutionNode[];
  edges: EvolutionEdge[];
  timeline: EvolutionTimelineEvent[];
  lineages: EvolutionLineage[];
  stats: Record<string, number>;
  manuscript?: ManuscriptCitationProjection;
};

export function buildResearchEvolutionProjection(workspace: ResearchWorkspace, options?: { projectId?: string }): ResearchEvolutionProjection;
export function buildManuscriptCitationProjection(options?: {
  projectId?: string;
  mainFile?: string;
  files?: Array<{ file: string; content?: string; citations: LatexCitationReference[] }>;
}): ManuscriptCitationProjection;
export function loadManuscriptCitationProjection(options?: { rootDir?: string; projectId?: string }): Promise<ManuscriptCitationProjection>;
export function mergeEvolutionProjections(research: ResearchEvolutionProjection, manuscript: ManuscriptCitationProjection): ResearchEvolutionProjection;
