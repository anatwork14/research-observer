import fs from "node:fs/promises";
import path from "node:path";
import { ChatGPTWebPrompt } from "@/components/ChatGPTWebPrompt";
import { InstructionViewer } from "@/components/InstructionViewer";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getProgressEntries } from "@/lib/progress";

async function readInstruction(pathname: string) {
  return fs.readFile(path.join(process.cwd(), ...pathname.split("/")), "utf8");
}

function promptBody(document: string) {
  const separator = "\n---\n";
  const index = document.indexOf(separator);
  return index >= 0 ? document.slice(index + separator.length).trim() : document.trim();
}

export default async function InstructionPage() {
  const entries = await getProgressEntries();
  const navEntries = entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const [rootAgents, progressAgents, noteSkill, dataContract, webPrompt] = await Promise.all([
    readInstruction("AGENTS.md"),
    readInstruction("progress/AGENTS.md"),
    readInstruction(".agents/skills/create-research-note/SKILL.md"),
    readInstruction("docs/OBSERVAIRE_DATA_CONTRACT.md"),
    readInstruction("docs/CHATGPT_WEB_RESEARCH_PROMPT.md"),
  ]);

  const sources = [
    { key: "root", label: "Authoring contract", path: "AGENTS.md", content: rootAgents },
    { key: "data", label: "Data + indexing contract", path: "docs/OBSERVAIRE_DATA_CONTRACT.md", content: dataContract },
    { key: "progress", label: "Research content rules", path: "progress/AGENTS.md", content: progressAgents },
    { key: "skill", label: "Create research note", path: ".agents/skills/create-research-note/SKILL.md", content: noteSkill },
    { key: "web", label: "ChatGPT Web starter prompt", path: "docs/CHATGPT_WEB_RESEARCH_PROMPT.md", content: webPrompt },
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
              Stable IDs, indexable metadata, evidence provenance, typed relationships, and linking rules now share one canonical contract.
              Use the ChatGPT Web generator when the model cannot read this repository directly.
            </p>
          </div>
          <span className="collection-count">{sources.length} canonical sources</span>
        </header>

        <section className="instruction-principles panel">
          <div><strong>1</strong><span>Stable ID is identity</span></div>
          <div><strong>2</strong><span>Metadata drives indexing</span></div>
          <div><strong>3</strong><span>Relationships drive graph semantics</span></div>
          <div><strong>4</strong><span>Evidence keeps provenance</span></div>
        </section>

        <ChatGPTWebPrompt template={promptBody(webPrompt)} />
        <InstructionViewer sources={sources} />
      </main>
    </div>
  );
}
