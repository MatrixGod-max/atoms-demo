import Link from "next/link";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { galleryApps, appUrl } from "@/lib/gallery";
import AppCard from "@/components/AppCard";
import TemplateCard, { type TemplateMeta } from "@/components/TemplateCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "资源中心 — Quark" };

export default async function Resources({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = tab === "templates" ? "templates" : "discover";
  const user = await getUser();
  const apps = galleryApps(12);
  const templates = db
    .prepare("SELECT id, name, category, platform, description FROM templates ORDER BY created_at")
    .all()
    .map((r) => ({ ...r })) as unknown as TemplateMeta[];

  return (
    <div className="flex-1 flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
          <span className="text-accent text-xl">⚛</span> Quark
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <Link href="/dashboard" className="btn-primary px-4 py-2">
              进入工作台
            </Link>
          ) : (
            <Link href="/register" className="btn-primary px-4 py-2">
              免费注册
            </Link>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 pb-16">
        <header className="mt-6 mb-6">
          <p className="font-mono text-xs tracking-[0.25em] text-muted mb-2">RESOURCES</p>
          <h1 className="text-2xl font-bold">资源中心</h1>
          <div className="flex gap-1 mt-5 border-b border-line">
            {(
              [
                ["discover", "发现", "社区发布的智能体作品"],
                ["templates", "模板", "各类网站与应用模板,快速开始"],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                href={`/resources?tab=${key}`}
                className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                  active === key ? "border-accent text-ink font-semibold" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </header>

        {active === "discover" ? (
          apps.length === 0 ? (
            <div className="card p-10 text-center text-muted text-sm">
              还没有发布的作品。<Link href="/" className="text-accent hover:underline">去生成第一个应用</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {apps.map((app) => (
                <AppCard key={app.slug} app={app} url={appUrl(app.slug)} />
              ))}
            </div>
          )
        ) : (
          <>
            <p className="text-muted text-sm mb-5 max-w-lg leading-relaxed">
              选一个模板一键开始:v1 即模板本身,之后像普通项目一样对话迭代、换主题、发布与部署。
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {templates.map((t) => (
                <TemplateCard key={t.id} template={t} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
