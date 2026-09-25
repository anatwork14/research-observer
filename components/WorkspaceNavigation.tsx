"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Section = "overview" | "projects" | "insights" | "new-research" | "notes" | "papers" | "evidence" | "graph" | "collections" | "health" | "instruction" | "settings";

const sections: Array<{ key: Section; href: string; label: string }> = [
  { key: "overview", href: "/", label: "Overview" },
  { key: "projects", href: "/projects", label: "Projects" },
  { key: "insights", href: "/insights", label: "Insights" },
  { key: "new-research", href: "/new-research", label: "New Research" },
  { key: "notes", href: "/progress", label: "Notes" },
  { key: "papers", href: "/papers", label: "Papers" },
  { key: "evidence", href: "/evidence", label: "Evidence" },
  { key: "graph", href: "/graph", label: "Graph" },
  { key: "collections", href: "/collections", label: "Collections" },
  { key: "health", href: "/health", label: "Health" },
  { key: "instruction", href: "/instruction", label: "Instruction" },
  { key: "settings", href: "/settings", label: "Settings" },
];

export function WorkspaceNavigation({ active }: { active: Section }) {
  const searchParams = useSearchParams();
  const project = searchParams.get("research");
  function hrefFor(href: string) {
    if (!project) return href;
    const params = new URLSearchParams({ research: project });
    return `${href}?${params.toString()}`;
  }
  return (
    <nav className="workspace-tabs" aria-label="Research workspace">
      {sections.map((section) => (
        <Link key={section.key} href={hrefFor(section.href)} className={section.key === active ? "active" : undefined} aria-current={section.key === active ? "page" : undefined}>
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
