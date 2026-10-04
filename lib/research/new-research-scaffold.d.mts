export type NewResearchScaffoldTarget =
  | { mode: "existing"; projectId: string }
  | { mode: "new"; projectLabel: string; projectDescription?: string };

export type NewResearchPlanSource = {
  sourceId: string;
  title: string;
  authors?: string[];
  year?: number;
  journal?: string;
  doi?: string;
  url?: string;
};

export type NewResearchPlan = {
  overview?: string;
  sources?: NewResearchPlanSource[];
  researchGaps?: Array<{ title: string; rationale: string; sourceIds?: string[] }>;
  hypotheses?: Array<{
    title: string;
    statement: string;
    falsificationCriterion: string;
    derivedFromGaps?: string[];
    sourceIds?: string[];
  }>;
  experiments?: Array<{
    title: string;
    hypothesisTitle: string;
    design: string;
    independentVariables?: string[];
    dependentVariables?: string[];
    controls?: string[];
    metrics?: string[];
    confounders?: string[];
    stoppingCriteria?: string[];
  }>;
  nextActions?: string[];
  cautions?: string[];
};

export type ResearchScaffoldPreview = {
  workspaceSignature: string;
  proposalHash: string;
  fingerprint: string;
  target: {
    mode: "existing" | "new";
    projectId: string;
    projectLabel: string;
    projectDescription: string;
    directory: string;
    createManifest: boolean;
  };
  manifest: { filename: string; content: string } | null;
  files: Array<{
    kind: string;
    id: string;
    title: string;
    type: string;
    filename: string;
    relationships: Array<{ type: string; target: string }>;
    content: string;
  }>;
  summary: {
    notes: number;
    hypotheses: number;
    experiments: number;
    evidenceObjects: 0;
    semanticEvidenceRelationships: 0;
  };
};

export function researchScaffoldWritable(): boolean;
export function previewResearchScaffold(options: {
  rootDir?: string;
  topic: string;
  objective?: string;
  plan: NewResearchPlan;
  target: NewResearchScaffoldTarget;
}): Promise<ResearchScaffoldPreview>;
export function applyResearchScaffold(options: {
  rootDir?: string;
  topic: string;
  objective?: string;
  plan: NewResearchPlan;
  target: NewResearchScaffoldTarget;
  expectedWorkspaceSignature: string;
  expectedProposalHash: string;
}): Promise<{
  project: { id: string; label: string; directory: string; created: boolean };
  notes: Array<{ slug: string; filename: string; title: string; type?: string; research: string }>;
  workspaceSignature: string;
}>;
