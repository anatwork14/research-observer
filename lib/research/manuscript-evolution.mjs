function manuscriptNodeId(projectId, file) {
  return `manuscript:${projectId}:${file}`;
}

function revisionNodeId(projectId, commit) {
  return `revision:${projectId}:${commit}`;
}

function edgeId(type, source, target) {
  return `revision:${type}:${source}->${target}`;
}

export function buildManuscriptRevisionProjection({ projectId = "default", history } = {}) {
  const revisions = history?.revisions || [];
  const nodes = new Map();
  const edges = [];
  const timeline = [];
  const ideHref = `/ide?research=${encodeURIComponent(projectId)}`;

  for (const revision of revisions) {
    const revisionId = revisionNodeId(projectId, revision.commit);
    nodes.set(revisionId, {
      id: revisionId,
      kind: "revision",
      label: revision.subject || revision.shortCommit,
      research: projectId,
      role: "revision",
      commit: revision.commit,
      shortCommit: revision.shortCommit,
      author: revision.author,
      date: revision.at,
      added: revision.added,
      removed: revision.removed,
      files: revision.files.map((file) => file.file),
      stateChanged: Boolean(revision.stateChanged),
      href: ideHref,
    });

    const fileStatus = `${revision.files.length} file${revision.files.length === 1 ? "" : "s"} · +${revision.added} −${revision.removed}`;
    timeline.push({
      id: `timeline:manuscript:${revision.commit}`,
      at: revision.at,
      kind: "manuscript",
      nodeId: revisionId,
      label: revision.subject || revision.shortCommit,
      research: projectId,
      type: "revision",
      status: revision.stateChanged && revision.files.length === 0
        ? "manuscript visibility state changed"
        : revision.stateChanged
          ? `${fileStatus} · visibility state changed`
          : fileStatus,
      commit: revision.commit,
    });

    for (const touched of revision.files) {
      const manuscriptId = manuscriptNodeId(projectId, touched.file);
      if (!nodes.has(manuscriptId)) {
        nodes.set(manuscriptId, {
          id: manuscriptId,
          kind: "manuscript",
          label: touched.file,
          research: projectId,
          file: touched.file,
          role: "manuscript",
          href: ideHref,
        });
      }
      edges.push({
        id: edgeId("revised_in", manuscriptId, revisionId),
        source: manuscriptId,
        target: revisionId,
        type: "revised_in",
        layer: "version",
        explicit: true,
      });
    }
  }

  return {
    projectId,
    nodes: [...nodes.values()],
    edges,
    timeline: timeline.sort((a, b) => a.at.localeCompare(b.at)),
    dirtyFiles: history?.dirtyFiles || [],
    available: Boolean(history?.available),
    stats: {
      revisions: revisions.length,
      dirtyFiles: history?.dirtyFiles?.length || 0,
    },
  };
}
