import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { compileResearchWorkspace, writeResearchArtifacts } from "./compiler.mjs";

function clean(value, max) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim().slice(0, max) : "";
}

function slugPart(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "note";
}

export function noteCreateWritable() {
  return process.env.RESEARCH_OBSERVER_WRITES === "1" || process.env.NODE_ENV !== "production";
}

export async function createResearchNote({ rootDir = process.cwd(), title, summary, type = "note", research = "", body = "" } = {}) {
  if (!noteCreateWritable()) throw new Error("Note creation is disabled in this environment.");
  const root = path.resolve(rootDir);
  const workspace = await compileResearchWorkspace({ rootDir: root, fresh: true });
  const cleanTitle = clean(title, 240).replace(/\s+/g, " ");
  const cleanSummary = clean(summary, 800).replace(/\s+/g, " ");
  const cleanBody = clean(body, 24000);
  const cleanType = clean(type, 80);
  const cleanResearch = clean(research, 120);
  if (!cleanTitle) throw new Error("Add a title for this note.");
  if (!cleanSummary) throw new Error("Add a short summary for this note.");
  if (!workspace.config.allowedTypes.includes(cleanType)) throw new Error("Choose a note type allowed by this workspace.");
  if (/<\/?(?:script|iframe|object|embed|video|audio)\b|javascript:/i.test(cleanBody)) {
    throw new Error("Embedded or executable content is not allowed in research notes.");
  }
  const project = cleanResearch ? workspace.projects.find((item) => item.id === cleanResearch) : workspace.projects.find((item) => item.id === "default");
  if (!project) throw new Error("Choose a project that exists in this workspace.");

  const projectEntries = workspace.entries.filter((entry) => entry.research === project.id);
  const order = projectEntries.reduce((max, entry) => Math.max(max, entry.order), -1) + 1;
  const slug = slugPart(cleanTitle);
  const id = `${slug}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const filename = `${String(order).padStart(2, "0")}_${slug}.md`;
  const relativeFile = path.posix.join(project.directory ?? "", filename);
  const absoluteFile = path.join(workspace.progressRoot, ...relativeFile.split("/"));
  const relativeToProject = Boolean(project.directory);
  const researchLine = !relativeToProject && project.id !== "default" ? [`research: ${JSON.stringify(project.id)}`] : [];
  const content = [
    "---",
    `id: ${id}`,
    `title: ${JSON.stringify(cleanTitle)}`,
    `summary: ${JSON.stringify(cleanSummary)}`,
    `type: ${JSON.stringify(cleanType)}`,
    ...(workspace.config.allowedStatuses.includes("idea") ? ["status: idea"] : []),
    ...researchLine,
    "---",
    "",
    `# ${cleanTitle}`,
    "",
    "## Notes",
    "",
    ...(cleanBody ? [cleanBody, ""] : [""]),
  ].join("\n");

  await fs.mkdir(path.dirname(absoluteFile), { recursive: true });
  try {
    await fs.writeFile(absoluteFile, content, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error("A note with that order and title already exists. Refresh and try again.");
    throw error;
  }
  try {
    const compiled = await writeResearchArtifacts({ rootDir: root, fresh: true });
    const errors = compiled.diagnostics.filter((item) => item.severity === "error" && item.file === relativeFile);
    if (errors.length) throw new Error("The new note failed workspace validation: " + errors.map((item) => item.message).join(" "));
    const entry = compiled.entries.find((item) => item.filename === relativeFile);
    if (!entry) throw new Error("The new note was not indexed by the research compiler.");
    return { slug: entry.slug, filename: relativeFile, title: entry.title, research: entry.research };
  } catch (error) {
    await fs.rm(absoluteFile, { force: true });
    await writeResearchArtifacts({ rootDir: root, fresh: true }).catch(() => null);
    throw error;
  }
}
