import { redirect } from "next/navigation";
import { getProgressEntries } from "@/lib/progress";

export const dynamic = "force-static";

export default async function Home() {
  const entries = await getProgressEntries();
  if (entries.length) redirect(`/progress/${entries[0].slug}`);

  return (
    <main className="empty-home">
      <div>
        <p className="eyebrow">Research Observer</p>
        <h1>No progress notes yet.</h1>
        <p>Add a file such as <code>progress/00_start.md</code> and reload.</p>
      </div>
    </main>
  );
}
