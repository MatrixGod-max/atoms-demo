import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { appUrl } from "@/lib/gallery";
import ArtifactTimeline, { type ArtifactRow } from "@/components/ArtifactTimeline";

export const dynamic = "force-dynamic";

export default async function ArtifactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = db
    .prepare(
      `SELECT p.id, p.user_id, p.name, p.published_version_id,
              (SELECT spec FROM app_versions WHERE id = p.published_version_id) AS spec
       FROM projects p WHERE p.slug = ? AND p.published_version_id IS NOT NULL`
    )
    .get(slug) as
    | { id: string; user_id: string; name: string; published_version_id: string; spec: string | null }
    | undefined;
  if (!project) notFound();

  let summary = "";
  try {
    summary = project.spec ? (JSON.parse(project.spec).summary ?? "") : "";
  } catch {
    // ignore malformed spec
  }

  const artifacts = db
    .prepare(
      `SELECT a.seq, a.notes, a.created_at, a.version_id, v.num AS version_num
       FROM artifacts a JOIN app_versions v ON v.id = a.version_id
       WHERE a.project_id = ? ORDER BY a.seq DESC`
    )
    .all(project.id)
    .map((r) => ({ ...r })) as unknown as ArtifactRow[];

  const user = await getUser();
  const isOwner = !!user && user.id === project.user_id && !user.isDemo;

  return (
    <div className="flex-1 flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
          <span className="text-accent text-xl">⚛</span> Quark
        </Link>
        <Link href="/explore" className="text-sm text-muted hover:text-ink">
          展厅
        </Link>
      </nav>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 pb-16">
        <header className="mt-6 mb-8">
          <p className="font-mono text-xs tracking-[0.25em] text-muted mb-2">ARTIFACT</p>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {summary && <p className="text-muted text-sm mt-2 max-w-lg leading-relaxed">{summary}</p>}
          <div className="flex items-center gap-2 mt-4">
            <a href={appUrl(slug)} target="_blank" rel="noopener" className="btn-primary px-4 py-2 text-sm">
              打开最新版
            </a>
            <Link href={`/remix/${slug}`} className="btn-ghost px-4 py-2 text-sm text-accent">
              ⚛ Remix
            </Link>
          </div>
        </header>

        <section>
          <h2 className="font-semibold text-sm mb-4">
            发布历史 <span className="font-mono text-xs text-muted ml-1">{artifacts.length} 个制品</span>
          </h2>
          <ArtifactTimeline
            slug={slug}
            projectId={project.id}
            artifacts={artifacts}
            latestVersionId={project.published_version_id}
            isOwner={isOwner}
          />
        </section>
      </main>
    </div>
  );
}
