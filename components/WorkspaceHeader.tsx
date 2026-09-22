import Link from "next/link";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorkspaceControls } from "@/components/WorkspaceControls";

type NavEntry = { slug: string; order: number; title: string; status?: string };
type Section = "overview" | "insights" | "new-research" | "notes" | "papers" | "evidence" | "graph" | "collections" | "health" | "instruction";

const sections: Array<{ key: Section; href: string; label: string }> = [
  { key: "overview", href: "/", label: "Overview" },
  { key: "insights", href: "/insights", label: "Insights" },
  { key: "new-research", href: "/new-research", label: "New Research" },
  { key: "notes", href: "/progress", label: "Notes" },
  { key: "papers", href: "/papers", label: "Papers" },
  { key: "evidence", href: "/evidence", label: "Evidence" },
  { key: "graph", href: "/graph", label: "Graph" },
  { key: "collections", href: "/collections", label: "Collections" },
  { key: "health", href: "/health", label: "Health" },
  { key: "instruction", href: "/instruction", label: "Instruction" },
];

export function WorkspaceHeader({
  entries,
  active,
  showWorkspaceControls = false,
}: {
  entries: NavEntry[];
  active: Section;
  showWorkspaceControls?: boolean;
}) {
  return (
    <header className="topbar workbench-topbar">
      <Link href="/" className="brand">
        <span className="brand-mark">◒</span>
        <span>RESEARCH <em>OBSERVER</em></span>
      </Link>

      <nav className="workspace-tabs" aria-label="Research workspace">
        {sections.map((section) => (
          <Link
            key={section.key}
            href={section.href}
            className={section.key === active ? "active" : undefined}
            aria-current={section.key === active ? "page" : undefined}
          >
            {section.label}
          </Link>
        ))}
      </nav>

      <CommandPalette entries={entries} />
      {showWorkspaceControls && <WorkspaceControls />}
      <ThemeToggle />
    </header>
  );
}
