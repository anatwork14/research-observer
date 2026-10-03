import type { ResearchEntry, ResearchRelationship, IncomingResearchRelationship } from "./compiler.mjs";

export type SemanticFieldChange = {
  field: string;
  label: string;
  before?: string;
  after?: string;
};

export type SemanticStringChanges = {
  added: string[];
  removed: string[];
};

export type SemanticOutgoingRelation = Pick<ResearchRelationship, "type" | "target" | "note">;
export type SemanticIncomingRelation = Pick<IncomingResearchRelationship, "type" | "source" | "note">;

export type ResearchSemanticDiff = {
  fieldChanges: SemanticFieldChange[];
  tags: SemanticStringChanges;
  headings: SemanticStringChanges;
  assets: SemanticStringChanges;
  relationships: { added: SemanticOutgoingRelation[]; removed: SemanticOutgoingRelation[] };
  incomingRelationships: { added: SemanticIncomingRelation[]; removed: SemanticIncomingRelation[] };
  incomingEvidence: { added: SemanticIncomingRelation[]; removed: SemanticIncomingRelation[] };
  summary: {
    changedDimensions: number;
    fieldChanges: number;
    tagChanges: number;
    headingChanges: number;
    assetChanges: number;
    relationshipChanges: number;
    incomingRelationshipChanges: number;
    evidenceSignalChanges: number;
  };
  hasChanges: boolean;
};

export type ResearchEvolutionPredecessor = {
  slug: string;
  title: string;
  note?: string;
  changes: ResearchSemanticDiff;
};

export function diffResearchSemantics(base?: Partial<ResearchEntry>, compare?: Partial<ResearchEntry>): ResearchSemanticDiff;
export function buildResearchEvolutionTrail(versions?: ResearchEntry[]): Array<{
  index: number;
  slug: string;
  title: string;
  date?: string;
  status?: string;
  predecessors: ResearchEvolutionPredecessor[];
  changes: ResearchSemanticDiff | null;
}>;
