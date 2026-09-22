import fs from "node:fs/promises";
import path from "node:path";
import { InstructionViewer } from "@/components/InstructionViewer";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getProgressEntries } from "@/lib/progress";

async function readInstruction(pathname: string) {
  return fs.readFile(path.join(process.cwd(), ...pathname.split("/")), "utf8");
}

export default async function InstructionPage() {
  const entries = await getProgressEntries();
  const navEntries = entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const [rootAgents, progressAgents, noteSkill] = await Promise.all([
    readInstruction("AGENTS.md"),
    readInstruction("progress/AGENTS.md"),
    readInstruction(".agents/skills/create-research-note/SKILL.md"),
  ]);

  const sources = [
    { key: "root", label: "Authoring contract", path: "AGENTS.md", content: rootAgents },
    { key: "progress", label: "Research content rules", path: "progress/AGENTS.md", content: progressAgents },
    { key: "skill", label: "Create research note", path: ".agents/skills/create-research-note/SKILL.md", content: noteSkill },
  ];

  return (
    <div className="site-shell">
      <WorkspaceHeader entries={navEntries} active="instruction" />
      <main className="collection-shell instruction-shell">
        <header className="collection-heading">
          <div>
            <p className="eyebrow">Instruction</p>
            <h1>Give an LLM the same research contract.</h1>
            <p>
              These are the actual repository instructions used by Codex and other agents. Copy the complete pack when asking another LLM to create Research Observer-compatible Markdown.
            </p>
          </div>
          <span className="collection-count">3 canonical sources</span>
        </header>

        <section className="instruction-principles panel">
          <div><strong>1</strong><span>Markdown is source of truth</span></div>
          <div><strong>2</strong><span>Stable IDs + existing targets</span></div>
          <div><strong>3</strong><span>No fabricated evidence</span></div>
          <div><strong>4</strong><span>Doctor before completion</span></div>
        </section>

        <InstructionViewer sources={sources} />
      </main>
    </div>
  );
}
