import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { appUrl } from "@/lib/gallery";
import ArtifactTimeline, { type ArtifactRow } from "@/components/ArtifactTimeline";

export const dynamic = "force-dynamic";

export default async function ArtifactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = db
    .prepare(
      `SELECT p.id, p.user_id, p.name, p.platform, p.published_version_id,
              (SELECT spec FROM app_versions WHERE id = p.published_version_id) AS spec
       FROM projects p WHERE p.slug = ? AND p.published_version_id IS NOT NULL`
    )
    .get(slug) as
    | {
        id: string;
        user_id: string;
        name: string;
        platform: "web" | "mobile";
        published_version_id: string;
        spec: string | null;
      }
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
  const isOwner = !!user && user.id === project.user_id;

  const isMobile = project.platform === "mobile";
  const latestUrl = appUrl(slug);
  let qrSvg: string | null = null;
  if (isMobile && latestUrl.startsWith("http")) {
    qrSvg = await QRCode.toString(latestUrl, {
      type: "svg",
      margin: 1,
      width: 148,
      color: { dark: "#18181b", light: "#ffffff00" },
    });
  }

  return (
    <div className="flex-1 flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
          <span className="text-accent text-xl">☀</span> Fusion
        </Link>
        <Link href="/resources" className="text-sm text-muted hover:text-ink">
          资源中心
        </Link>
      </nav>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 pb-16">
        <header className="mt-6 mb-8">
          <p className="font-mono text-xs tracking-[0.25em] text-muted mb-2">
            {isMobile ? "MOBILE ARTIFACT · 可安装 PWA" : "ARTIFACT"}
          </p>
          <h1 className="text-2xl font-bold">
            <span className="mr-2">{isMobile ? "📱" : "🌐"}</span>
            {project.name}
          </h1>
          {summary && <p className="text-muted text-sm mt-2 max-w-lg leading-relaxed">{summary}</p>}
          <div className="flex items-center gap-2 mt-4">
            <a href={latestUrl} target="_blank" rel="noopener" className="btn-primary px-4 py-2 text-sm">
              打开最新版
            </a>
            <Link href={`/remix/${slug}`} className="btn-ghost px-4 py-2 text-sm text-accent">
              ⚛ Remix
            </Link>
            <Link
              href={`/resources?fuse=${encodeURIComponent(slug)}`}
              className="btn-ghost px-4 py-2 text-sm"
              title="以它为素材,再选一个应用进行聚变合成"
            >
              ⚛ 用它聚变
            </Link>
          </div>

          {isMobile && (
            <div className="card p-4 mt-6 flex items-center gap-5 flex-wrap">
              {qrSvg && (
                <div className="shrink-0" dangerouslySetInnerHTML={{ __html: qrSvg }} aria-label="扫码在手机上打开" />
              )}
              <div className="text-sm leading-relaxed min-w-52 flex-1">
                <p className="font-semibold mb-1.5">手机扫码安装</p>
                <p className="text-muted text-xs">
                  iOS:Safari 打开 → 分享 <span className="text-ink">⎋</span> → 「添加到主屏幕」
                  <br />
                  Android:Chrome 打开 → 菜单 ⋮ → 「安装应用 / 添加到主屏幕」
                  <br />
                  安装后离线可用,数据云端同步。
                </p>
              </div>
            </div>
          )}
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
