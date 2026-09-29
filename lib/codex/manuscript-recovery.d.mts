export type ManuscriptRecoveryRecord = {
  file: string;
  existed: boolean;
  backup: string | null;
  mode: number | null;
};

export type ManuscriptRecoveryManifest = {
  schemaVersion: 1;
  proposalId: string;
  createdAt: string;
  files: ManuscriptRecoveryRecord[];
};

export function createManuscriptRecoverySnapshot(options: {
  root?: string;
  proposalId: string;
  files: string[];
}): Promise<ManuscriptRecoveryManifest>;

export function restoreManuscriptRecoverySnapshot(options: {
  root?: string;
  proposalId: string;
}): Promise<{ restored: string[] }>;

export function deleteManuscriptRecoverySnapshot(options: {
  root?: string;
  proposalId: string;
}): Promise<void>;
