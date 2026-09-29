function errorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

export async function recoverAppliedManuscript({ reversePatch, restoreSnapshot, deleteSnapshot } = {}) {
  if (typeof reversePatch !== "function" || typeof restoreSnapshot !== "function" || typeof deleteSnapshot !== "function") {
    throw new Error("Manuscript recovery requires reversePatch, restoreSnapshot, and deleteSnapshot callbacks.");
  }

  const rollback = await reversePatch();
  if (rollback?.code === 0) {
    try {
      await deleteSnapshot();
      return {
        recovered: true,
        method: "reverse-patch",
        rollback,
        snapshotRetained: false,
      };
    } catch (error) {
      return {
        recovered: true,
        method: "reverse-patch",
        rollback,
        snapshotRetained: true,
        cleanupError: errorMessage(error, "Recovery snapshot cleanup failed."),
      };
    }
  }

  let snapshot;
  try {
    snapshot = await restoreSnapshot();
  } catch (error) {
    snapshot = { ok: false, error: errorMessage(error, "Could not restore the manuscript recovery snapshot.") };
  }

  if (snapshot?.ok) {
    return {
      recovered: true,
      method: "snapshot",
      rollback,
      restored: snapshot.restored ?? [],
      snapshotRetained: false,
    };
  }

  return {
    recovered: false,
    method: "failed",
    rollback,
    recoveryError: snapshot?.error || "Could not restore the manuscript recovery snapshot.",
    snapshotRetained: true,
  };
}
