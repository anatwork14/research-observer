import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { CommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorkspaceControls } from "@/components/WorkspaceControls";
import { WorkspaceNavigation } from "@/components/WorkspaceNavigation";
import { WorkspaceProjectSelector } from "@/components/WorkspaceProjectSelector";

type NavEntry = { slug: string; order: number; title: string; status?: string };
type Section = "overview" | "projects" | "insights" | "new-research" | "notes" | "papers" | "evidence" | "graph" | "collections" | "health" | "instruction" | "settings";

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
      <Link href="/" className="brand" aria-label="Observaire home">
        <span className="brand-mark" aria-hidden="true">
          <Image className="brand-logo brand-logo-light" src="/brand/observaire-mark-light.svg" alt="" width={36} height={36} priority />
          <Image className="brand-logo brand-logo-dark" src="/brand/observaire-mark-dark.svg" alt="" width={36} height={36} priority />
        </span>
        <span className="brand-copy">
          <strong>OBSERVAIRE</strong>
          <small>Research intelligence</small>
        </span>
      </Link>

      <Suspense fallback={<nav className="workspace-tabs" aria-label="Research workspace" />}>
        <WorkspaceNavigation active={active} />
      </Suspense>

      <CommandPalette entries={entries} />
      <Suspense fallback={<span className="project-context-selector">Project</span>}>
        <WorkspaceProjectSelector />
      </Suspense>
      {showWorkspaceControls && <WorkspaceControls />}
      <ThemeToggle />
    </header>
  );
}
