import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "./compiler.mjs";
import { projectIdFromFolder, projectManifest } from "./project-folders.mjs";

const MAX_HYPOTHESES = 8;
const MAX_EXPERIMENTS = 8;
const MAX_GAPS = 8;
const MAX_SOURCES = 20;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function clean(value, max = 2000) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function cleanLine(value, max = 1000) {
  return clean(value, max).replace(/\s+/g, " ");
}

function cleanList(value, maxItems = 16, maxChars = 600) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => cleanLine(item, maxChars)).filter(Boolean))].slice(0, maxItems)
    : [];
}

function slugPart(value, max = 48) {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
  return normalized || "research";
}

function safeProjectFolder(value) {
  const label = cleanLine(value, 120);
  if (!label) throw new Error("Add a name for the new research project.");
  const folder = label
    .normalize("NFKC")
    .replace(/[\\/\u0000-\u001f\u007f]+/g, "-")
    .replace(/^\.+/, "")
    .replace(/[. ]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (!folder || folder === "." || folder === ".." || folder.startsWith(".observaire")) {
    throw new Error("Choose a normal project name without a reserved or hidden folder name.");
  }
  if (path.basename(folder) !== folder) throw new Error("Project names cannot contain path separators.");
  return folder;
}

function normalizeSource(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const sourceId = cleanLine(source.sourceId, 300);
  const title = cleanLine(source.title, 600);
  if (!sourceId || !title) return null;
  const authors = cleanList(source.authors, 20, 240);
  const yearValue = Number(source.year);
  const year = Number.isInteger(yearValue) && yearValue >= 1000 && yearValue <= 9999 ? yearValue : undefined;
  const doi = cleanLine(source.doi, 300).replace(/^doi:\s*/i, "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  const rawUrl = cleanLine(source.url, 1200);
  const url = /^https:\/\//i.test(rawUrl) ? rawUrl : "";
  return {
    sourceId,
    title,
    authors,
    ...(year ? { year } : {}),
    ...(cleanLine(source.journal, 300) ? { journal: cleanLine(source.journal, 300) } : {}),
    ...(doi ? { doi } : {}),
    ...(url ? { url } : {}),
  };
}

function normalizePlan(value) {
  const plan = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const researchGaps = Array.isArray(plan.researchGaps) ? plan.researchGaps.slice(0, MAX_GAPS).flatMap((gap) => {
    if (!gap || typeof gap !== "object" || Array.isArray(gap)) return [];
    const title = cleanLine(gap.title, 300);
    const rationale = clean(gap.rationale, 2400);
    if (!title || !rationale) return [];
    return [{ title, rationale, sourceIds: cleanList(gap.sourceIds, MAX_SOURCES, 300) }];
  }) : [];
  const hypotheses = Array.isArray(plan.hypotheses) ? plan.hypotheses.slice(0, MAX_HYPOTHESES).flatMap((hypothesis) => {
    if (!hypothesis || typeof hypothesis !== "object" || Array.isArray(hypothesis)) return [];
    const title = cleanLine(hypothesis.title, 300);
    const statement = clean(hypothesis.statement, 2400);
    const falsificationCriterion = clean(hypothesis.falsificationCriterion, 2400);
    if (!title || !statement || !falsificationCriterion) return [];
    return [{
      title,
      statement,
      falsificationCriterion,
      derivedFromGaps: cleanList(hypothesis.derivedFromGaps, MAX_GAPS, 300),
      sourceIds: cleanList(hypothesis.sourceIds, MAX_SOURCES, 300),
    }];
  }) : [];
  const experiments = Array.isArray(plan.experiments) ? plan.experiments.slice(0, MAX_EXPERIMENTS).flatMap((experiment) => {
    if (!experiment || typeof experiment !== "object" || Array.isArray(experiment)) return [];
    const title = cleanLine(experiment.title, 300);
    const hypothesisTitle = cleanLine(experiment.hypothesisTitle, 300);
    const design = clean(experiment.design, 4000);
    if (!title || !hypothesisTitle || !design) return [];
    return [{
      title,
      hypothesisTitle,
      design,
      independentVariables: cleanList(experiment.independentVariables),
      dependentVariables: cleanList(experiment.dependentVariables),
      controls: cleanList(experiment.controls),
      metrics: cleanList(experiment.metrics),
      confounders: cleanList(experiment.confounders),
      stoppingCriteria: cleanList(experiment.stoppingCriteria),
    }];
  }) : [];
  const sources = Array.isArray(plan.sources)
    ? plan.sources.slice(0, MAX_SOURCES).map(normalizeSource).filter(Boolean)
    : [];
  return {
    overview: clean(plan.overview, 5000),
    researchGaps,
    hypotheses,
    experiments,
    nextActions: cleanList(plan.nextActions, 16, 1000),
    cautions: cleanList(plan.cautions, 16, 1400),
    sources,
  };
}

function normalizeTarget(workspace, target) {
  const mode = target?.mode === "new" ? "new" : "existing";
  if (mode === "existing") {
    const projectId = cleanLine(target?.projectId, 120);
    const project = workspace.projects.find((item) => item.id === projectId);
    if (!project) throw new Error("Choose an existing research project.");
    return {
      mode,
      projectId: project.id,
      projectLabel: project.label,
      projectDescription: project.description || "",
      directory: project.directory || "",
      createManifest: false,
    };
  }

  const projectLabel = cleanLine(target?.projectLabel, 120);
  const directory = safeProjectFolder(projectLabel);
  const projectId = projectIdFromFolder(directory);
  if (!ID.test(projectId)) throw new Error("The derived project id is invalid.");
  if (workspace.projects.some((item) => item.id === projectId)) {
    throw new Error(`A project with id “${projectId}” already exists. Choose that project or use a different name.`);
  }
  if (workspace.projects.some((item) => item.directory === directory)) {
    throw new Error("A project already uses that folder name.");
  }
  return {
    mode,
    projectId,
    projectLabel,
    projectDescription: clean(target?.projectDescription, 800),
    directory,
    createManifest: true,
  };
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

function markdownList(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- Not specified.";
}

function sourceLine(source) {
  const meta = [
    source.authors?.length ? source.authors.join(", ") : "",
    source.year,
    source.journal,
    source.doi ? `DOI ${source.doi}` : "",
  ].filter(Boolean).join(" · ");
  const identity = source.url || (source.doi ? `https://doi.org/${source.doi}` : "");
  return `- **${source.title}**${meta ? ` — ${meta}` : ""}${identity ? ` — ${identity}` : ""}  \n  Provider/source id: \`${source.sourceId}\``;
}

function noteContent({ id, title, summary, type, status, research, relationships = [], body }) {
  const relationLines = relationships.length
    ? ["relationships:", ...relationships.flatMap((relation) => [
        `  - type: ${yamlString(relation.type)}`,
        `    target: ${yamlString(relation.target)}`,
      ])]
    : [];
  return [
    "---",
    `id: ${id}`,
    `title: ${yamlString(title)}`,
    `summary: ${yamlString(summary)}`,
    `type: ${yamlString(type)}`,
    ...(status ? [`status: ${yamlString(status)}`] : []),
    ...(research ? [`research: ${yamlString(research)}`] : []),
    ...relationLines,
    "---",
    "",
    `# ${title}`,
    "",
    body.trim(),
    "",
  ].join("\n");
}

function buildFiles({ workspace, topic, objective, plan, target }) {
  const projectEntries = workspace.entries.filter((entry) => entry.research === target.projectId);
  const startOrder = target.mode === "existing"
    ? projectEntries.reduce((max, entry) => Math.max(max, entry.order), -1) + 1
    : 0;
  const seed = JSON.stringify({ topic, objective, plan, projectId: target.projectId });
  const fingerprint = crypto.createHash("sha256").update(seed, "utf8").digest("hex");
  const idFor = (kind, index, title) => `${slugPart(`${kind}-${title}`, 56)}-${crypto.createHash("sha256").update(`${fingerprint}:${kind}:${index}`, "utf8").digest("hex").slice(0, 8)}`;
  const relative = (filename) => target.directory ? path.posix.join(target.directory, filename) : filename;
  const research = !target.directory && target.projectId !== "default" ? target.projectId : "";
  const status = workspace.config.allowedStatuses.includes("idea") ? "idea" : "";
  const questionId = idFor("question", 0, topic);
  const planId = idFor("plan", 0, topic);
  const sourceSection = plan.sources.length
    ? plan.sources.map(sourceLine).join("\n")
    : "No durable literature metadata was included in this planning packet.";
  const gapSection = plan.researchGaps.length
    ? plan.researchGaps.map((gap, index) => `### Gap ${index + 1}: ${gap.title}\n\n${gap.rationale}\n\nSource ids: ${gap.sourceIds.length ? gap.sourceIds.map((item) => `\`${item}\``).join(", ") : "none specified"}.`).join("\n\n")
    : "No research gap was proposed.";
  const files = [];
  const questionFilename = `${String(startOrder).padStart(2, "0")}_${slugPart(topic)}.md`;
  files.push({
    kind: "question",
    id: questionId,
    title: topic,
    type: "question",
    filename: relative(questionFilename),
    relationships: [],
    content: noteContent({
      id: questionId,
      title: topic,
      summary: objective || `Primary research question for ${topic}.`,
      type: "question",
      status,
      research,
      body: [
        "## Question",
        "",
        topic,
        "",
        "## Objective",
        "",
        objective || "No separate objective was provided. Refine this section before treating the scope as final.",
        "",
        "## Current state",
        "",
        "This scaffold was created from a reviewed planning proposal. It does not claim that the question has been answered.",
        "",
        "## Planning trace",
        "",
        `See [the reviewed research plan](${String(startOrder + 1).padStart(2, "0")}_${slugPart(`${topic}-research-plan`)}.md).`,
      ].join("\n"),
    }),
  });

  const planFilename = `${String(startOrder + 1).padStart(2, "0")}_${slugPart(`${topic}-research-plan`)}.md`;
  files.push({
    kind: "plan",
    id: planId,
    title: `${topic} — research plan`,
    type: "note",
    filename: relative(planFilename),
    relationships: [],
    content: noteContent({
      id: planId,
      title: `${topic} — research plan`,
      summary: plan.overview || `Reviewed planning trace for ${topic}.`,
      type: "note",
      status,
      research,
      body: [
        "## Review boundary",
        "",
        "This note preserves the reviewed New Research planning proposal. Consensus metadata and model-generated synthesis remain discovery/planning context, not automatic evidence or proof.",
        "",
        "## Synthesis",
        "",
        plan.overview || "No synthesis was supplied.",
        "",
        "## Selected literature packet",
        "",
        sourceSection,
        "",
        "## Proposed research gaps",
        "",
        gapSection,
        "",
        "## Next actions",
        "",
        markdownList(plan.nextActions),
        "",
        "## Cautions",
        "",
        markdownList(plan.cautions),
      ].join("\n"),
    }),
  });

  const hypothesisIds = new Map();
  plan.hypotheses.forEach((hypothesis, index) => {
    const order = startOrder + 2 + index;
    const id = idFor("hypothesis", index, hypothesis.title);
    hypothesisIds.set(hypothesis.title, id);
    const filename = `${String(order).padStart(2, "0")}_${slugPart(hypothesis.title)}.md`;
    files.push({
      kind: "hypothesis",
      id,
      title: hypothesis.title,
      type: "hypothesis",
      filename: relative(filename),
      relationships: [{ type: "derived_from", target: planId }],
      content: noteContent({
        id,
        title: hypothesis.title,
        summary: hypothesis.statement,
        type: "hypothesis",
        status,
        research,
        relationships: [{ type: "derived_from", target: planId }],
        body: [
          "## Hypothesis",
          "",
          hypothesis.statement,
          "",
          "## Falsification criterion",
          "",
          hypothesis.falsificationCriterion,
          "",
          "## Planning basis",
          "",
          `Primary question: [${topic}](${questionFilename}).`,
          "",
          hypothesis.derivedFromGaps.length ? `Proposed gaps: ${hypothesis.derivedFromGaps.join("; ")}.` : "No specific research gap was named.",
          "",
          hypothesis.sourceIds.length ? `Planning source ids: ${hypothesis.sourceIds.map((item) => `\`${item}\``).join(", ")}.` : "No specific literature source id was named for this hypothesis.",
          "",
          "## Integrity note",
          "",
          "This is a falsifiable research hypothesis created from a reviewed planning proposal. It is not a result or conclusion.",
        ].join("\n"),
      }),
    });
  });

  plan.experiments.forEach((experiment, index) => {
    const order = startOrder + 2 + plan.hypotheses.length + index;
    const id = idFor("experiment", index, experiment.title);
    const targetHypothesis = hypothesisIds.get(experiment.hypothesisTitle);
    const relationships = targetHypothesis ? [{ type: "investigates", target: targetHypothesis }] : [];
    const filename = `${String(order).padStart(2, "0")}_${slugPart(experiment.title)}.md`;
    files.push({
      kind: "experiment",
      id,
      title: experiment.title,
      type: "experiment",
      filename: relative(filename),
      relationships,
      content: noteContent({
        id,
        title: experiment.title,
        summary: experiment.design,
        type: "experiment",
        status,
        research,
        relationships,
        body: [
          "## Purpose",
          "",
          targetHypothesis
            ? `Tests the reviewed hypothesis **${experiment.hypothesisTitle}**.`
            : `The planning proposal referenced hypothesis **${experiment.hypothesisTitle}**, but no matching scaffold hypothesis was found. Review and link this experiment explicitly before execution.`,
          "",
          "## Design",
          "",
          experiment.design,
          "",
          "## Variables",
          "",
          "### Independent variables",
          "",
          markdownList(experiment.independentVariables),
          "",
          "### Dependent variables",
          "",
          markdownList(experiment.dependentVariables),
          "",
          "## Metrics",
          "",
          markdownList(experiment.metrics),
          "",
          "## Controls",
          "",
          markdownList(experiment.controls),
          "",
          "## Confounders",
          "",
          markdownList(experiment.confounders),
          "",
          "## Stopping criteria",
          "",
          markdownList(experiment.stoppingCriteria),
          "",
          "## Results",
          "",
          "No result has been recorded. Do not convert this planned experiment into a conclusion until measurements are captured with provenance.",
        ].join("\n"),
      }),
    });
  });

  return { files, fingerprint };
}

function proposalHash({ workspaceSignature, target, files, manifest }) {
  return crypto.createHash("sha256").update(JSON.stringify({
    workspaceSignature,
    target,
    files: files.map((file) => ({ filename: file.filename, content: file.content })),
    manifest,
  }), "utf8").digest("hex");
}

function diagnosticKey(item) {
  return [item.severity, item.code, item.file || "", item.message].join("|");
}

export function researchScaffoldWritable() {
  return process.env.RESEARCH_OBSERVER_WRITES === "1" || process.env.NODE_ENV !== "production";
}

export async function previewResearchScaffold({ rootDir = process.cwd(), topic, objective = "", plan, target } = {}) {
  const root = path.resolve(rootDir);
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const cleanTopic = cleanLine(topic, 1400);
  const cleanObjective = clean(objective, 3000);
  if (!cleanTopic) throw new Error("A research topic or question is required.");
  const normalizedPlan = normalizePlan(plan);
  if (!normalizedPlan.hypotheses.length && !normalizedPlan.experiments.length) {
    throw new Error("The reviewed plan needs at least one hypothesis or experiment before scaffolding.");
  }
  const normalizedTarget = normalizeTarget(workspace, target);
  const { files, fingerprint } = buildFiles({
    workspace,
    topic: cleanTopic,
    objective: cleanObjective,
    plan: normalizedPlan,
    target: normalizedTarget,
  });
  const manifest = normalizedTarget.createManifest
    ? projectManifest({
        id: normalizedTarget.projectId,
        label: normalizedTarget.projectLabel,
        description: normalizedTarget.projectDescription || `Created from the New Research workflow for ${cleanTopic}.`,
      })
    : "";
  const hash = proposalHash({ workspaceSignature: workspace.signature, target: normalizedTarget, files, manifest });
  return {
    workspaceSignature: workspace.signature,
    proposalHash: hash,
    fingerprint,
    target: normalizedTarget,
    manifest: manifest ? { filename: path.posix.join(normalizedTarget.directory, ".observaire-project.json"), content: manifest } : null,
    files,
    summary: {
      notes: files.length,
      hypotheses: files.filter((file) => file.type === "hypothesis").length,
      experiments: files.filter((file) => file.type === "experiment").length,
      evidenceObjects: 0,
      semanticEvidenceRelationships: 0,
    },
  };
}

export async function applyResearchScaffold({ rootDir = process.cwd(), topic, objective = "", plan, target, expectedWorkspaceSignature, expectedProposalHash } = {}) {
  if (!researchScaffoldWritable()) throw new Error("New Research scaffold writes are disabled in this environment.");
  const root = path.resolve(rootDir);
  const before = await compileResearchWorkspace({ rootDir: root, fresh: true });
  if (!expectedWorkspaceSignature || before.signature !== expectedWorkspaceSignature) {
    const error = new Error("The research workspace changed after preview. Build a fresh scaffold preview before applying.");
    error.code = "SCAFFOLD_STALE";
    throw error;
  }
  const preview = await previewResearchScaffold({ rootDir: root, topic, objective, plan, target });
  if (!expectedProposalHash || preview.proposalHash !== expectedProposalHash) {
    const error = new Error("The scaffold proposal changed after review. Build a fresh preview before applying.");
    error.code = "SCAFFOLD_CHANGED";
    throw error;
  }

  const progressRoot = before.progressRoot;
  const created = [];
  const projectRoot = preview.target.directory ? path.join(progressRoot, preview.target.directory) : progressRoot;
  if (preview.target.mode === "new") {
    try {
      await fs.stat(projectRoot);
      throw new Error("The target project folder now exists. Build a fresh preview with another project name.");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const paths = [
    ...(preview.manifest ? [preview.manifest] : []),
    ...preview.files.map((file) => ({ filename: file.filename, content: file.content })),
  ];
  for (const file of paths) {
    const absolute = path.resolve(progressRoot, ...file.filename.split("/"));
    const relative = path.relative(progressRoot, absolute);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Scaffold output escaped the configured research root.");
    }
    try {
      await fs.stat(absolute);
      throw new Error(`Scaffold target already exists: ${file.filename}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  const baselineErrors = new Set(before.diagnostics.filter((item) => item.severity === "error").map(diagnosticKey));
  try {
    for (const file of paths) {
      const absolute = path.resolve(progressRoot, ...file.filename.split("/"));
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, file.content, { encoding: "utf8", flag: "wx" });
      created.push(absolute);
    }

    const compiled = await writeResearchArtifacts({ rootDir: root, fresh: true });
    const newErrors = compiled.diagnostics
      .filter((item) => item.severity === "error" && !baselineErrors.has(diagnosticKey(item)));
    if (newErrors.length) {
      throw new Error("The scaffold introduced validation errors: " + newErrors.slice(0, 6).map((item) => item.message).join(" "));
    }

    const notes = preview.files.map((file) => {
      const entry = compiled.entries.find((item) => item.filename === file.filename);
      if (!entry) throw new Error(`The research compiler did not index scaffold file ${file.filename}.`);
      return { slug: entry.slug, filename: entry.filename, title: entry.title, type: entry.type, research: entry.research };
    });
    return {
      project: {
        id: preview.target.projectId,
        label: preview.target.projectLabel,
        directory: preview.target.directory,
        created: preview.target.mode === "new",
      },
      notes,
      workspaceSignature: compiled.signature,
    };
  } catch (error) {
    for (const absolute of created.reverse()) await fs.rm(absolute, { force: true }).catch(() => null);
    if (preview.target.mode === "new") await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => null);
    await writeResearchArtifacts({ rootDir: root, fresh: true }).catch(() => null);
    throw error;
  }
}
