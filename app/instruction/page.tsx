import fs from "node:fs/promises";
import path from "node:path";
import { ChatGPTWebPrompt } from "@/components/ChatGPTWebPrompt";
import { InstructionViewer } from "@/components/InstructionViewer";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getProgressEntries } from "@/lib/progress";

async function readInstruction(pathname: string) {
  return fs.readFile(path.join(process.cwd(), ...pathname.split("/")), "utf8");
}

async function readMountedResearchInstructions() {
  try {
    return await readInstruction("progress/AGENTS.md");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [
        "# Research content rules",
        "",
        "`progress/AGENTS.md` is not present in the currently mounted research directory.",
        "This is expected when `OBSERVAIRE_RESEARCH_DIR` points at an external host folder.",
        "Use the repository `AGENTS.md`, `docs/OBSERVAIRE_DATA_CONTRACT.md`, the JSON Schema, and the live workspace config as the active authoring contract.",
        "",
      ].join("\n");
    }
    throw error;
  }
}

function promptBody(document: string) {
  const separator = "\n---\n";
  const index = document.indexOf(separator);
  return index >= 0 ? document.slice(index + separator.length).trim() : document.trim();
}

const experimentAuthoringContract = [
  "## Experiment authoring requirements",
  "For projects with experiments, reuse metric IDs/aliases from existing evaluation plans before creating metrics. Define an evaluation objective and dataset or measurement population where applicable; primary, secondary, and guardrail metrics; direction, unit, aggregation, baseline, comparison plan, ablation factors, controls, success criteria, and failure/regression criteria.",
  "Use type: evaluation with evaluationPlan for structured definitions, and experimentSpec.evaluationPlan to reference one existing stable ID. Keep outcomes unclaimed until measured. Preserve raw import files and metric provenance. Markdown-discovered metric prose is advisory until reviewed and adopted.",
].join("\n\n");

export default async function InstructionPage() {
  const entries = await getProgressEntries();
  const navEntries = entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const [rootAgents, progressAgents, noteSkill, dataContract, schema, workspaceConfig, webPrompt] = await Promise.all([
    readInstruction("AGENTS.md"),
    readMountedResearchInstructions(),
    readInstruction(".agents/skills/create-research-note/SKILL.md"),
    readInstruction("docs/OBSERVAIRE_DATA_CONTRACT.md"),
    readInstruction("docs/observaire-research-frontmatter.schema.json"),
    readInstruction("research-observer.config.json"),
    readInstruction("docs/CHATGPT_WEB_RESEARCH_PROMPT.md"),
  ]);

  const sources = [
    { key: "root", label: "Authoring contract", path: "AGENTS.md", content: rootAgents },
    { key: "data", label: "Data + indexing contract", path: "docs/OBSERVAIRE_DATA_CONTRACT.md", content: dataContract },
    { key: "schema", label: "Frontmatter JSON Schema", path: "docs/observaire-research-frontmatter.schema.json", content: schema },
    { key: "config", label: "Workspace vocabulary + projects", path: "research-observer.config.json", content: workspaceConfig },
    { key: "progress", label: "Research content rules", path: "progress/AGENTS.md", content: progressAgents },
    { key: "skill", label: "Create research note", path: ".agents/skills/create-research-note/SKILL.md", content: noteSkill },
    { key: "web", label: "ChatGPT Web starter prompt", path: "docs/CHATGPT_WEB_RESEARCH_PROMPT.md", content: webPrompt, includeInPack: false },
  ];

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="instruction" />
      <main className="collection-shell instruction-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Instruction</p>
            <h1>Give every AI the same research contract.</h1>
            <p>
              Stable IDs, indexable metadata, evidence provenance, typed relationships, current workspace vocabularies, and project IDs now travel together.
              Use the ChatGPT Web generator when the model cannot read this repository directly.
            </p>
          </div>
          <span className="collection-count">{sources.length} instruction sources</span>
        </header>

        <section className="instruction-principles panel">
          <div><strong>1</strong><span>Stable ID is identity</span></div>
          <div><strong>2</strong><span>Metadata drives indexing</span></div>
          <div><strong>3</strong><span>Relationships drive graph semantics</span></div>
          <div><strong>4</strong><span>Evidence keeps provenance</span></div>
        </section>

        <ChatGPTWebPrompt template={`${promptBody(webPrompt)}\n\n${experimentAuthoringContract}`} workspaceConfig={workspaceConfig} />
        <InstructionViewer sources={sources} />
      </main>
    </div>
  );
}
