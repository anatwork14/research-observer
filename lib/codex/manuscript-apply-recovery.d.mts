export type ManuscriptRollbackCommand = {
  code: number;
  stdout?: string;
  stderr?: string;
};

export type ManuscriptSnapshotRestore = {
  ok: boolean;
  restored?: string[];
  error?: string;
  cleanupError?: string;
};

export type ManuscriptRecoveryResult = {
  recovered: boolean;
  method: "reverse-patch" | "snapshot" | "failed";
  rollback: ManuscriptRollbackCommand;
  restored?: string[];
  snapshotRetained: boolean;
  cleanupError?: string;
  recoveryError?: string;
};

export function recoverAppliedManuscript(options: {
  reversePatch: () => Promise<ManuscriptRollbackCommand>;
  restoreSnapshot: () => Promise<ManuscriptSnapshotRestore>;
  deleteSnapshot: () => Promise<unknown>;
}): Promise<ManuscriptRecoveryResult>;
