import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PdfReader } from "@/components/PdfReader";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { getResearchWorkspace } from "@/lib/progress";

export const dynamic = "force-dynamic";

function assetUrl(path: string) {
  return "/_research/media/" + path.split("/").map(encodeURIComponent).join("/");
}

function displayTitle(path: string) {
  return (path.split("/").pop() ?? path).replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");
}

export async function generateStaticParams() {
  const workspace = await getResearchWorkspace();
  return workspace.assets
    .filter((asset) => asset.extension === ".pdf")
    .map((asset) => ({ path: asset.path.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const { path } = await params;
  const researchPath = path.join("/");
  return { title: `${displayTitle(researchPath)} · Papers · Research Observer` };
}

export default async function PaperPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ path }, query, workspace] = await Promise.all([params, searchParams, getResearchWorkspace()]);
  const researchPath = path.join("/");
  const asset = workspace.assets.find((item) => item.path === researchPath && item.extension === ".pdf");
  if (!asset) notFound();

  const relatedNotes = workspace.entries
    .filter((entry) => entry.assets.includes(asset.path))
    .map(({ slug, order, title, type, source }) => ({ slug, order, title, type, sourcePage: source?.pdf === asset.path ? source.page : undefined }));
  const navEntries = workspace.entries.map(({ slug, order, title, status }) => ({ slug, order, title, status }));
  const relationshipTargets = workspace.entries.map(({ slug, title, type }) => ({ slug, title, type }));
  const initialPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  return (
    <div className="site-shell pdf-site-shell">
      <WorkspaceHeader entries={navEntries} active="papers" />
      <PdfReader
        src={assetUrl(asset.path)}
        path={asset.path}
        title={displayTitle(asset.path)}
        initialPage={initialPage}
        relatedNotes={relatedNotes}
        relationshipTypes={workspace.config.allowedRelationshipTypes}
        relationshipTargets={relationshipTargets}
      />
    </div>
  );
}
