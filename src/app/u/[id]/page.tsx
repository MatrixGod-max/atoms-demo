import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { appUrl, userPublishedApps } from "@/lib/gallery";
import AppCard from "@/components/AppCard";

export const dynamic = "force-dynamic";

export default async function ProfilePage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = db.prepare("SELECT id, name, created_at FROM users WHERE id = ?").get(id) as
    | { id: string; name: string; created_at: number }
    | undefined;
  if (!user) notFound();

  const apps = userPublishedApps(user.id);

  return (
    <div className="min-h-dvh">
      <header className="max-w-4xl mx-auto px-6 pt-6">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← 返回 Fusion
        </Link>
      </header>
      <main className="max-w-4xl mx-auto px-6 pb-16">
        <section className="flex items-center gap-4 mt-8 mb-10">
          <span className="w-16 h-16 rounded-2xl bg-accent/80 text-white text-2xl font-semibold flex items-center justify-center">
            {user.name[0]?.toUpperCase() ?? "?"}
          </span>
          <div>
            <h1 className="font-serif-display font-bold text-2xl">{user.name}</h1>
            <p className="text-xs text-muted mt-1">
              加入于 {new Date(user.created_at).toLocaleDateString("zh-CN")} · 已发布 {apps.length} 个应用
            </p>
          </div>
        </section>

        {apps.length === 0 ? (
          <div className="card p-10 text-center text-muted text-sm">该用户还没有发布任何应用。</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app) => (
              <AppCard key={app.slug} app={app} url={appUrl(app.slug)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
